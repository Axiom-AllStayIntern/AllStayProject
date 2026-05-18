<script lang="ts">
	import { startRecording, stopRecording, isRecording } from '$lib/utils/recorder.js';
	import { processVoiceInput, type AIResponse } from '$lib/services/ai-conversation.js';

	export let onResult: (response: AIResponse) => void;

	type State = 'idle' | 'listening' | 'processing' | 'speaking';
	let state: State = 'idle';
	let autoStopTimer: ReturnType<typeof setTimeout>;

	async function handleClick() {
		if (state === 'idle') {
			try {
				await startRecording();
				state = 'listening';
				autoStopTimer = setTimeout(handleStop, 15_000);
			} catch (err) {
				dispatch('error', err instanceof Error ? err.message : 'Could not access microphone');
			}
		} else if (state === 'listening') {
			await handleStop();
		}
	}

	async function handleStop() {
		clearTimeout(autoStopTimer);
		if (!isRecording()) return;
		state = 'processing';
		try {
			const blob = await stopRecording();
			const response = await processVoiceInput(blob);
			state = 'speaking';
			onResult(response);
			setTimeout(() => { state = 'idle'; }, 2000);
		} catch (err) {
			dispatch('error', err instanceof Error ? err.message : 'Voice processing failed');
			state = 'idle';
		}
	}

	function dispatch(event: string, message: string) {
		// Re-surface errors as a synthetic result so the parent can toast them
		if (event === 'error') {
			onResult({ text: message, action: null, confidence: 0 });
		}
	}

	$: label =
		state === 'idle' ? 'Start voice input' :
		state === 'listening' ? 'Stop recording' :
		state === 'processing' ? 'Processing…' :
		'Speaking…';
</script>

<button
	class="voice-btn"
	class:listening={state === 'listening'}
	class:processing={state === 'processing'}
	class:speaking={state === 'speaking'}
	on:click={handleClick}
	disabled={state === 'processing' || state === 'speaking'}
	aria-label={label}
	title={label}
>
	{#if state === 'processing'}
		<span class="spinner">⏳</span>
	{:else if state === 'speaking'}
		<span class="wave">🔊</span>
	{:else}
		🎤
	{/if}
</button>

<style>
	.voice-btn {
		position: fixed;
		bottom: 88px; /* above BottomNav */
		right: 24px;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		font-size: 24px;
		display: grid;
		place-items: center;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
		z-index: 200;
		transition: background-color 0.25s, transform 0.15s;

		/* idle — deep navy */
		background: var(--navy-800, #1a2744);
		color: #fff;
		animation: pulse 2.5s ease-in-out infinite;
	}

	.voice-btn:disabled {
		cursor: default;
	}

	.voice-btn:not(:disabled):active {
		transform: scale(0.92);
	}

	/* listening — red with ripple */
	.voice-btn.listening {
		background: #e53935;
		animation: ripple 1.2s ease-out infinite;
	}

	/* processing — amber, spin handled by child */
	.voice-btn.processing {
		background: #f57c00;
		animation: none;
	}

	/* speaking — green with wave handled by child */
	.voice-btn.speaking {
		background: #2e7d32;
		animation: none;
	}

	/* Idle pulse */
	@keyframes pulse {
		0%, 100% { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); }
		50%        { box-shadow: 0 4px 24px rgba(26, 39, 68, 0.55); }
	}

	/* Listening ripple */
	@keyframes ripple {
		0%   { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.55); }
		70%  { box-shadow: 0 0 0 18px rgba(229, 57, 53, 0); }
		100% { box-shadow: 0 0 0 0 rgba(229, 57, 53, 0); }
	}

	/* Processing spinner */
	.spinner {
		display: inline-block;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Speaking wave */
	.wave {
		display: inline-block;
		animation: bounce 0.6s ease-in-out infinite alternate;
	}
	@keyframes bounce {
		from { transform: scaleY(0.85); }
		to   { transform: scaleY(1.15); }
	}
</style>
