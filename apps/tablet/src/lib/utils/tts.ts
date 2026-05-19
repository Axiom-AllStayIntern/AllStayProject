let currentAudio:   HTMLAudioElement | null = null;
let abortPlayback:  (() => void) | null = null;
let fetchAbort:     AbortController | null = null;

/** Stop any in-flight TTS fetch, audio playback, or Web Speech utterance. */
export function stopSpeaking() {
	// 1. Abort the in-flight fetch / blob read
	if (fetchAbort) {
		fetchAbort.abort();
		fetchAbort = null;
	}
	// 2. Stop HTMLAudioElement playback
	if (currentAudio) {
		currentAudio.pause();
		currentAudio = null;
	}
	// 3. Resolve the awaited speakText promise
	abortPlayback?.();
	abortPlayback = null;
	// 4. Stop Web Speech fallback if active
	if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
		window.speechSynthesis.cancel();
	}
}

export function isSpeaking(): boolean {
	return (currentAudio !== null && !currentAudio.paused) || !!fetchAbort;
}

/**
 * Speak text via OpenAI TTS endpoint.
 * Falls back to Web Speech API if the network call fails.
 * Resolves when audio finishes OR when stopSpeaking() is called.
 */
export async function speakText(text: string): Promise<void> {
	stopSpeaking();

	return new Promise<void>(async (resolve) => {
		// Register abort handler immediately — before any await —
		// so stopSpeaking() can resolve this promise at any point.
		abortPlayback = resolve;

		try {
			const ac = new AbortController();
			fetchAbort = ac;

			const res = await fetch('/api/tts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text }),
				signal: ac.signal
			});
			fetchAbort = null;

			if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

			const blob = await res.blob();

			// Check if we were stopped while reading the blob
			if (!abortPlayback) { resolve(); return; }

			const url   = URL.createObjectURL(blob);
			const audio = new Audio(url);
			currentAudio = audio;

			const finish = () => {
				URL.revokeObjectURL(url);
				currentAudio = null;
				abortPlayback = null;
				resolve();
			};
			abortPlayback   = finish;
			audio.onended   = finish;
			audio.onerror   = finish;
			audio.play().catch(finish);
		} catch (err: unknown) {
			fetchAbort = null;
			const isAbort = err instanceof Error && err.name === 'AbortError';
			if (isAbort) {
				// Already resolved by stopSpeaking via abortPlayback
				return;
			}
			// Network/parse error → try Web Speech fallback
			fallbackSpeak(text, resolve);
		}
	});
}

function fallbackSpeak(text: string, onDone: () => void) {
	if (!('speechSynthesis' in window)) { onDone(); return; }
	window.speechSynthesis.cancel();
	const utt     = new SpeechSynthesisUtterance(text);
	utt.rate      = 1.0;
	utt.onend     = () => { abortPlayback = null; onDone(); };
	utt.onerror   = () => { abortPlayback = null; onDone(); };
	abortPlayback = () => { window.speechSynthesis.cancel(); onDone(); };
	window.speechSynthesis.speak(utt);
}
