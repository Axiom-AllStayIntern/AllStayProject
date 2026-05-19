<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { WakeDetector } from '$lib/utils/wake-detector.js';
	import { attachSilenceVAD } from '$lib/utils/silence-vad.js';
	import { processVoiceInput, type AIResponse } from '$lib/services/ai-conversation.js';
	import { speakText, stopSpeaking } from '$lib/utils/tts.js';
	import { language } from '$lib/stores/language.js';
	import { conversationHistory } from '$lib/stores/conversation.js';

	export let onResult: (r: AIResponse) => void;

	// ── State machine ──────────────────────────────────────────────────────────
	type State = 'idle' | 'listening' | 'processing' | 'speaking';
	let state: State = 'idle';

	// ── Session timer (3-min max) ──────────────────────────────────────────────
	const SESSION_MAX_MS  = 3 * 60 * 1_000;
	const SESSION_WARN_MS = (2 * 60 + 50) * 1_000;
	let sessionMaxTimer:  ReturnType<typeof setTimeout> | null = null;
	let sessionWarnTimer: ReturnType<typeof setTimeout> | null = null;
	let showSessionWarning = false;

	// ── Voice gate constants ───────────────────────────────────────────────────
	const VOICE_GATE_RMS    = 0.04;  // RMS threshold to start recording after TTS
	const POST_TTS_DELAY_MS = 300;   // ms to let TTS echo die down before monitoring

	// ── Recording resources ────────────────────────────────────────────────────
	let recStream: MediaStream | null = null;
	let recorder:  MediaRecorder | null = null;
	let chunks:    Blob[] = [];
	let vadStop:   (() => void) | null = null;

	// ── Detectors ──────────────────────────────────────────────────────────────
	let wakeDetector: WakeDetector;

	// ── Lifecycle ──────────────────────────────────────────────────────────────
	onMount(() => {
		wakeDetector = new WakeDetector({ onWakeWord: handleWakeWord });
		wakeDetector.start();
	});

	onDestroy(teardown);

	// ── IDLE → SESSION via wake word ───────────────────────────────────────────
	function handleWakeWord() {
		if (state !== 'idle') return;
		wakeDetector.stop();
		startSession();
	}

	function startSession() {
		showSessionWarning = false;

		sessionWarnTimer = setTimeout(() => {
			showSessionWarning = true;
		}, SESSION_WARN_MS);

		sessionMaxTimer = setTimeout(() => {
			goIdle();
		}, SESSION_MAX_MS);

		startListening();
	}

	function stopSessionTimers() {
		if (sessionWarnTimer) { clearTimeout(sessionWarnTimer); sessionWarnTimer = null; }
		if (sessionMaxTimer)  { clearTimeout(sessionMaxTimer);  sessionMaxTimer  = null; }
		showSessionWarning = false;
	}

	// ── LISTENING state ────────────────────────────────────────────────────────
	// postTts=true: wait for echo to settle then gate on voice before recording starts
	async function startListening(postTts = false) {
		state = 'listening';

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (state !== 'listening') { stream.getTracks().forEach(t => t.stop()); return; }
			recStream = stream;

			if (postTts) {
				await new Promise(r => setTimeout(r, POST_TTS_DELAY_MS));
				if (state !== 'listening') { releaseStream(); return; }
				await waitForVoiceGate(stream);
				if (state !== 'listening') { releaseStream(); return; }
			}

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

	// Waits until mic RMS exceeds VOICE_GATE_RMS (user has started speaking).
	function waitForVoiceGate(stream: MediaStream): Promise<void> {
		return new Promise(resolve => {
			const ctx      = new AudioContext();
			const src      = ctx.createMediaStreamSource(stream);
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 512;
			src.connect(analyser);
			const buf = new Float32Array(analyser.fftSize);
			let rafId = 0;
			let done  = false;

			const finish = () => {
				if (done) return;
				done = true;
				cancelAnimationFrame(rafId);
				src.disconnect();
				ctx.close().catch(() => {});
				resolve();
			};

			function tick() {
				if (done || state !== 'listening') { finish(); return; }
				analyser.getFloatTimeDomainData(buf);
				let s = 0;
				for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
				if (Math.sqrt(s / buf.length) > VOICE_GATE_RMS) { finish(); return; }
				rafId = requestAnimationFrame(tick);
			}
			tick();
		});
	}

	// ── Silence detected → PROCESSING ─────────────────────────────────────────
	async function handleSilence() {
		if (state !== 'listening') return;

		vadStop?.(); vadStop = null;
		state = 'processing';

		const blob = await drainRecorder();
		releaseStream();

		if (state === 'idle') return; // session ended by timer

		// Trivially small blob → resume listening without resetting session
		if (!blob || blob.size < 500) {
			startListening();
			return;
		}

		try {
			const response = await processVoiceInput(blob, $language);

			if (state === 'idle') return;

			if (!response.text?.trim()) {
				startListening();
				return;
			}

			// Close-session intent: speak goodbye then end
			if (response.action?.type === 'close_session') {
				state = 'speaking';
				onResult(response);
				await speakText(response.text);
				goIdle();
				return;
			}

			state = 'speaking';
			onResult(response);
			await speakText(response.text);

			if (state === 'idle') return;

			if (state === 'speaking') {
				startListening(true);
			}
		} catch {
			if (state !== 'idle') startListening();
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

	// ── IDLE state ─────────────────────────────────────────────────────────────
	function goIdle() {
		stopSessionTimers();
		stopSpeaking();
		vadStop?.(); vadStop = null;
		releaseStream();
		state = 'idle';
		wakeDetector?.start();
	}

	function teardown() {
		wakeDetector?.stop();
		stopSpeaking();
		stopSessionTimers();
		vadStop?.();
		releaseStream();
	}

	// ── Manual button tap ──────────────────────────────────────────────────────
	function handleButtonClick() {
		if (longPressed) { longPressed = false; return; }  // swallow click after long-press
		if (state === 'idle') {
			wakeDetector.stop();
			startSession();
		} else if (state === 'listening') {
			handleSilence();
		} else if (state === 'speaking') {
			stopSpeaking();
			startListening(true);
		}
		// processing: ignore taps
	}

	// ── Long-press to close session ────────────────────────────────────────────
	const LONG_PRESS_MS = 600;
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let longPressing = false;
	let longPressed  = false;   // blocks the subsequent click event

	function handlePointerDown(e: PointerEvent) {
		if (state === 'idle' || state === 'processing') return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		longPressing = true;
		longPressTimer = setTimeout(() => {
			longPressing = false;
			longPressed  = true;
			goIdle();
		}, LONG_PRESS_MS);
	}

	function handlePointerUp() {
		if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
		longPressing = false;
	}

	// ── Derived ────────────────────────────────────────────────────────────────
	$: bubbles = $conversationHistory.slice(-3);

	$: ariaLabel =
		state === 'idle'        ? 'Say "Start" to begin' :
		state === 'listening'   ? 'Listening…' :
		state === 'processing'  ? 'Processing…' :
		                          'Tap to interrupt';
</script>

<div class="assistant-root">
	<!-- ── Session warning ──────────────────────────────────────────────── -->
	{#if showSessionWarning}
		<div class="session-warning" role="alert">
			{$language === 'zh' ? '对话将在10秒后结束' : 'Conversation ending in 10s…'}
		</div>
	{/if}

	<!-- ── Conversation bubbles ─────────────────────────────────────────── -->
	{#if state !== 'idle' && bubbles.length > 0}
		<div class="chat-bubbles">
			{#each bubbles as turn, i}
				<div class="bubble" class:user={turn.role === 'user'} class:assistant={turn.role === 'assistant'}>
					{turn.content}
				</div>
			{/each}
		</div>
	{/if}

	<!-- ── Voice button ──────────────────────────────────────────────────── -->
	<div class="voice-btn-wrap">
		{#if longPressing}
			<svg class="hold-ring" viewBox="0 0 64 64" aria-hidden="true">
				<circle cx="32" cy="32" r="30"
					stroke="#ef5350" stroke-width="3" fill="none"
					stroke-dasharray="188.5" stroke-dashoffset="188.5"
					style="animation-duration:{LONG_PRESS_MS}ms"
				/>
			</svg>
		{/if}
		<button
			class="voice-btn"
			class:listening={state === 'listening'}
			class:processing={state === 'processing'}
			class:speaking={state === 'speaking'}
			on:click={handleButtonClick}
			on:pointerdown={handlePointerDown}
			on:pointerup={handlePointerUp}
			on:pointercancel={handlePointerUp}
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
		{:else}
			<svg class="icon-mic" viewBox="0 0 24 24" aria-hidden="true">
				<rect x="9" y="1" width="6" height="13" rx="3" fill="currentColor"/>
				<path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
				<line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
				<line x1="9"  y1="23" x2="15" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
			</svg>
		{/if}
		</button>
	</div>
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
		align-items: flex-end;
		gap: 8px;
	}

	/* ── Session warning toast ───────────────────────────────────────────────── */
	.session-warning {
		font-size: 12px;
		color: #fff;
		background: rgba(229, 115, 20, 0.9);
		padding: 6px 12px;
		border-radius: 12px;
		white-space: nowrap;
		backdrop-filter: blur(4px);
		animation: fadeIn 0.3s ease;
	}

	/* ── Conversation bubbles ────────────────────────────────────────────────── */
	.chat-bubbles {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-width: 300px;
		width: max-content;
		align-items: flex-end;
	}

	.bubble {
		max-width: 280px;
		padding: 8px 12px;
		border-radius: 16px;
		font-size: 13px;
		line-height: 1.4;
		word-break: break-word;
		animation: fadeIn 0.2s ease;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
	}

	.bubble.user {
		background: #1a2744;
		color: #fff;
		border-bottom-right-radius: 4px;
		align-self: flex-end;
	}

	.bubble.assistant {
		background: rgba(255, 255, 255, 0.92);
		color: #1a2744;
		border-bottom-left-radius: 4px;
		align-self: flex-start;
	}

	/* ── Voice button wrapper + hold ring ───────────────────────────────────── */
	.voice-btn-wrap {
		position: relative;
		width: 56px;
		height: 56px;
	}

	.hold-ring {
		position: absolute;
		inset: -4px;
		width: calc(100% + 8px);
		height: calc(100% + 8px);
		pointer-events: none;
		transform: rotate(-90deg);
	}

	.hold-ring circle {
		animation: holdStroke linear forwards;
	}

	@keyframes holdStroke {
		to { stroke-dashoffset: 0; }
	}

	/* ── Voice button ────────────────────────────────────────────────────────── */
	.voice-btn {
		width: 100%;
		height: 100%;
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

	/* ── SVG icons ───────────────────────────────────────────────────────────── */
	.icon-mic,
	.icon-wave {
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

	@keyframes spin { to { transform: rotate(360deg); } }

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(4px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	@keyframes eq {
		0%, 100% { transform: scaleY(0.5); }
		50%       { transform: scaleY(1.2); }
	}
</style>
