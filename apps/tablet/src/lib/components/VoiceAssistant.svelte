<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { WakeDetector } from '$lib/utils/wake-detector.js';
	import { attachSilenceVAD } from '$lib/utils/silence-vad.js';
	import { processVoiceInput, type AIResponse } from '$lib/services/ai-conversation.js';
	import { speakText, stopSpeaking } from '$lib/utils/tts.js';
	import { language } from '$lib/stores/language.js';

	export let onResult: (r: AIResponse) => void;

	// ── State machine ──────────────────────────────────────────────────────────
	type State = 'idle' | 'listening' | 'processing' | 'speaking' | 'active_wait';
	let state: State = 'idle';

	// ── Active-wait countdown ──────────────────────────────────────────────────
	const WAIT_SECS      = 20;
	const RING_RADIUS    = 26;
	const CIRCUMFERENCE  = 2 * Math.PI * RING_RADIUS;

	let waitRemaining   = WAIT_SECS;
	let sessionExpiresAt = 0;         // epoch ms; 0 = not yet set
	let waitInterval: ReturnType<typeof setInterval> | null = null;

	// ── Recording resources ────────────────────────────────────────────────────
	let recStream: MediaStream | null = null;
	let recorder:  MediaRecorder | null = null;
	let chunks:    Blob[] = [];
	let vadStop:   (() => void) | null = null;

	// ── Detectors ──────────────────────────────────────────────────────────────
	let wakeDetector: WakeDetector;

	// Web Speech API used for two purposes:
	//  • SPEAKING state → any speech interrupts TTS
	//  • ACTIVE_WAIT state → any speech starts a new listening session
	let activityRec: SpeechRecognition | null = null;

	// ── Lifecycle ──────────────────────────────────────────────────────────────
	onMount(() => {
		wakeDetector = new WakeDetector({ onWakeWord: handleWakeWord });
		wakeDetector.start();
	});

	onDestroy(teardown);

	// ── IDLE → LISTENING via wake word ─────────────────────────────────────────
	function handleWakeWord() {
		if (state !== 'idle') return;
		wakeDetector.stop();
		startListening();
	}

	// ── LISTENING state ────────────────────────────────────────────────────────
	async function startListening() {
		state = 'listening';
		stopWaitCountdown();
		stopActivityRec();

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			recStream = stream;

			const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
			chunks  = [];
			recorder = new MediaRecorder(stream, { mimeType });
			recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
			recorder.start();

			vadStop = attachSilenceVAD(stream, {
				onSilenceAfterVoice: handleSilence,
				onTimeout:           handleSilence
			});
		} catch {
			goIdle();
		}
	}

	// ── Silence detected → PROCESSING ─────────────────────────────────────────
	async function handleSilence() {
		if (state !== 'listening') return;

		vadStop?.(); vadStop = null;
		state = 'processing';

		const blob = await drainRecorder();
		releaseStream();

		// Ignore trivially small blobs (< 500 bytes ≈ pure silence/noise)
		if (!blob || blob.size < 500) {
			goActiveWait(false);
			return;
		}

		try {
			const response = await processVoiceInput(blob, $language);

			// Empty STT → mumbling/background noise; don't reset the 20 s timer
			if (!response.text?.trim()) {
				goActiveWait(false);
				return;
			}

			// Valid command — move to SPEAKING and reset the session timer
			state = 'speaking';
			onResult(response);
			startActivityRec();           // listen for interruptions while TTS plays
			await speakText(response.text);

			if (state === 'speaking') {
				// Natural end (not interrupted by user speech)
				goActiveWait(true);
			}
			// If interrupted, handleActivitySpeech already changed state
		} catch {
			goActiveWait(false);
		}
	}

	function drainRecorder(): Promise<Blob | null> {
		return new Promise((resolve) => {
			if (!recorder || recorder.state === 'inactive') {
				const blob = chunks.length ? new Blob(chunks, { type: chunks[0].type }) : null;
				chunks = [];
				resolve(blob);
				return;
			}
			const mimeType = chunks[0]?.type ?? 'audio/webm';
			recorder.onstop = () => {
				const blob = chunks.length ? new Blob(chunks, { type: mimeType }) : null;
				chunks = [];
				resolve(blob);
			};
			recorder.stop();
		});
	}

	function releaseStream() {
		recStream?.getTracks().forEach(t => t.stop());
		recStream  = null;
		recorder   = null;
	}

	// ── ACTIVE_WAIT state ──────────────────────────────────────────────────────
	function goActiveWait(resetTimer: boolean) {
		stopActivityRec();
		state = 'active_wait';

		// Set (or keep) the expiry timestamp
		if (resetTimer || sessionExpiresAt === 0) {
			sessionExpiresAt = Date.now() + WAIT_SECS * 1_000;
		}
		waitRemaining = Math.max(1, Math.ceil((sessionExpiresAt - Date.now()) / 1_000));

		stopWaitCountdown();
		waitInterval = setInterval(() => {
			const rem = Math.ceil((sessionExpiresAt - Date.now()) / 1_000);
			waitRemaining = Math.max(0, rem);
			if (Date.now() >= sessionExpiresAt) goIdle();
		}, 250);

		// Any speech in this window triggers the next command cycle
		startActivityRec(true);
	}

	// ── Activity recognition (SPEAKING interruption / ACTIVE_WAIT detection) ──
	function startActivityRec(forActiveWait = false) {
		stopActivityRec();
		if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) return;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
		const r: SpeechRecognition = new SR();
		activityRec = r;

		r.continuous     = true;
		r.interimResults = true;
		r.lang           = 'en-US';

		r.onresult = async (ev: SpeechRecognitionEvent) => {
			for (let i = ev.resultIndex; i < ev.results.length; i++) {
				const text = ev.results[i][0].transcript.trim();
				if (text.length < 2) continue;

				if (state === 'speaking') {
					// User speaks during TTS → interrupt and start new command
					stopSpeaking();
					stopActivityRec();
					state = 'listening';   // guard against re-entry before await
					await startListening();
					return;
				}

				if (state === 'active_wait' && forActiveWait) {
					// User speaks within the 20 s window → start new command
					stopActivityRec();
					stopWaitCountdown();
					await startListening();
					return;
				}
			}
		};

		// Auto-restart so recognition stays alive for the entire state duration
		r.onend = () => {
			if (activityRec === r && (state === 'speaking' || state === 'active_wait')) {
				setTimeout(() => {
					if (state === 'speaking' || state === 'active_wait') startActivityRec(forActiveWait);
				}, 200);
			}
		};

		r.onerror = () => { /* handled via onend restart */ };

		try { r.start(); } catch { /* already running */ }
	}

	function stopActivityRec() {
		const r = activityRec;
		activityRec = null;
		try { r?.abort(); } catch { /* ok */ }
	}

	// ── IDLE state ─────────────────────────────────────────────────────────────
	function goIdle() {
		stopWaitCountdown();
		stopActivityRec();
		stopSpeaking();
		vadStop?.(); vadStop = null;
		releaseStream();
		sessionExpiresAt = 0;
		state = 'idle';
		wakeDetector?.start();
	}

	function stopWaitCountdown() {
		if (waitInterval) { clearInterval(waitInterval); waitInterval = null; }
	}

	function teardown() {
		wakeDetector?.stop();
		stopActivityRec();
		stopSpeaking();
		stopWaitCountdown();
		vadStop?.();
		releaseStream();
	}

	// ── Manual button tap ──────────────────────────────────────────────────────
	function handleButtonClick() {
		if (state === 'idle') {
			wakeDetector.stop();
			startListening();
		} else if (state === 'listening') {
			handleSilence();
		} else if (state === 'speaking') {
			stopSpeaking();
			goActiveWait(false);
		} else if (state === 'active_wait') {
			stopWaitCountdown();
			stopActivityRec();
			startListening();
		}
	}

	// ── Derived values ─────────────────────────────────────────────────────────
	$: dashOffset  = CIRCUMFERENCE * (1 - waitRemaining / WAIT_SECS);
	$: waitLabel   = $language === 'zh' ? '继续说...' : 'Still here...';
	$: ariaLabel   =
		state === 'idle'        ? 'Say "Hi Sirui" to start' :
		state === 'listening'   ? 'Listening…' :
		state === 'processing'  ? 'Processing…' :
		state === 'speaking'    ? 'Tap to interrupt' :
		                          ($language === 'zh' ? `继续说 (${waitRemaining}s)` : `Still listening (${waitRemaining}s)`);
</script>

<div class="assistant-root">
	<!-- ── Active-wait ring ──────────────────────────────────────────────── -->
	{#if state === 'active_wait'}
		<div class="wait-ring" aria-hidden="true">
			<svg width="72" height="72" viewBox="0 0 64 64">
				<circle cx="32" cy="32" r={RING_RADIUS} class="ring-track" />
				<circle
					cx="32" cy="32" r={RING_RADIUS}
					class="ring-fill"
					stroke-dasharray={CIRCUMFERENCE}
					stroke-dashoffset={dashOffset}
					transform="rotate(-90 32 32)"
				/>
			</svg>
			<span class="wait-secs">{waitRemaining}</span>
		</div>
		<div class="wait-label">{waitLabel}</div>
	{/if}

	<!-- ── Voice button ──────────────────────────────────────────────────── -->
	<button
		class="voice-btn"
		class:listening={state === 'listening'}
		class:processing={state === 'processing'}
		class:speaking={state === 'speaking'}
		class:active-wait={state === 'active_wait'}
		on:click={handleButtonClick}
		disabled={state === 'processing'}
		aria-label={ariaLabel}
		title={ariaLabel}
	>
		{#if state === 'processing'}
			<span class="spinner" aria-hidden="true"></span>
		{:else if state === 'speaking'}
			<svg class="icon-wave" viewBox="0 0 24 24" aria-hidden="true">
				<rect class="bar b1" x="2"  y="6"  width="3" height="12" rx="1.5"/>
				<rect class="bar b2" x="7"  y="2"  width="3" height="20" rx="1.5"/>
				<rect class="bar b3" x="12" y="5"  width="3" height="14" rx="1.5"/>
				<rect class="bar b4" x="17" y="9"  width="3" height="6"  rx="1.5"/>
				<rect class="bar b5" x="22" y="7"  width="3" height="10" rx="1.5"/>
			</svg>
		{:else if state === 'listening'}
			<svg class="icon-mic" viewBox="0 0 24 24" aria-hidden="true">
				<rect x="9" y="1" width="6" height="13" rx="3" fill="currentColor"/>
				<path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
				<line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				<line x1="9"  y1="23" x2="15" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		{:else if state === 'active_wait'}
			<svg class="icon-ear" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M6 9a6 6 0 1 1 12 0c0 3.5-2 5-3 7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
				<path d="M10 9a2 2 0 0 1 4 0c0 1.5-1 2.5-1.5 3.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
				<circle cx="9" cy="20" r="1.5" fill="currentColor"/>
			</svg>
		{:else}
			<!-- idle: microphone icon -->
			<svg class="icon-mic" viewBox="0 0 24 24" aria-hidden="true">
				<rect x="9" y="1" width="6" height="13" rx="3" fill="currentColor"/>
				<path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
				<line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				<line x1="9"  y1="23" x2="15" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		{/if}
	</button>
</div>

<style>
	/* ── Root container ──────────────────────────────────────────────────────── */
	.assistant-root {
		position: fixed;
		bottom: 88px;
		right: 24px;
		z-index: 200;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	/* ── Active-wait ring ────────────────────────────────────────────────────── */
	.wait-ring {
		position: relative;
		width: 72px;
		height: 72px;
		display: grid;
		place-items: center;
	}

	.wait-ring svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.ring-track {
		fill: none;
		stroke: rgba(255, 255, 255, 0.2);
		stroke-width: 4;
	}

	.ring-fill {
		fill: none;
		stroke: #4fc3f7;
		stroke-width: 4;
		stroke-linecap: round;
		transition: stroke-dashoffset 0.25s linear;
	}

	.wait-secs {
		position: relative;
		font-size: 16px;
		font-weight: 700;
		color: #fff;
		line-height: 1;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
	}

	.wait-label {
		font-size: 11px;
		color: #fff;
		background: rgba(2, 136, 209, 0.85);
		padding: 3px 10px;
		border-radius: 10px;
		white-space: nowrap;
		pointer-events: none;
		backdrop-filter: blur(4px);
	}

	/* ── Voice button ────────────────────────────────────────────────────────── */
	.voice-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		color: #fff;
		display: grid;
		place-items: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		transition: background-color 0.25s, transform 0.15s;
		background: var(--navy-800, #1a2744);
		animation: pulse 2.5s ease-in-out infinite;
	}

	.voice-btn:not(:disabled):active { transform: scale(0.92); }
	.voice-btn:disabled { cursor: default; }

	.voice-btn.listening {
		background: #e53935;
		animation: ripple 1.2s ease-out infinite;
	}

	.voice-btn.processing {
		background: #f57c00;
		animation: none;
	}

	.voice-btn.speaking {
		background: #2e7d32;
		animation: none;
	}

	.voice-btn.active-wait {
		background: #0288d1;
		animation: breathe 2s ease-in-out infinite;
	}

	/* ── SVG icons ───────────────────────────────────────────────────────────── */
	.icon-mic,
	.icon-wave,
	.icon-ear {
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}

	/* Animated equaliser bars for SPEAKING state */
	.bar { fill: currentColor; transform-origin: center bottom; }
	.b1 { animation: eq 0.9s ease-in-out infinite; }
	.b2 { animation: eq 0.7s ease-in-out infinite 0.1s; }
	.b3 { animation: eq 1.1s ease-in-out infinite 0.2s; }
	.b4 { animation: eq 0.8s ease-in-out infinite 0.05s; }
	.b5 { animation: eq 1.0s ease-in-out infinite 0.15s; }

	/* Processing spinner */
	.spinner {
		width: 20px;
		height: 20px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/* ── Keyframes ───────────────────────────────────────────────────────────── */
	@keyframes pulse {
		0%, 100% { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); }
		50%       { box-shadow: 0 4px 24px rgba(26, 39, 68, 0.55); }
	}

	@keyframes ripple {
		0%   { box-shadow: 0 0 0 0   rgba(229, 57, 53, 0.55); }
		70%  { box-shadow: 0 0 0 18px rgba(229, 57, 53, 0);    }
		100% { box-shadow: 0 0 0 0   rgba(229, 57, 53, 0);     }
	}

	@keyframes breathe {
		0%, 100% { box-shadow: 0 0 0 0   rgba(2, 136, 209, 0.45); }
		50%       { box-shadow: 0 0 0 14px rgba(2, 136, 209, 0);    }
	}

	@keyframes spin { to { transform: rotate(360deg); } }

	@keyframes eq {
		0%, 100% { transform: scaleY(0.5); }
		50%       { transform: scaleY(1.2); }
	}
</style>
