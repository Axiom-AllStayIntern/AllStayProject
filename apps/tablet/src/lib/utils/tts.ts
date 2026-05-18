let currentAudio: HTMLAudioElement | null = null;
// Resolves the in-flight speakText promise when stopSpeaking is called mid-playback.
let abortPlayback: (() => void) | null = null;

/** Stop any currently playing TTS. The awaited speakText() call will resolve immediately. */
export function stopSpeaking() {
	if (currentAudio) {
		currentAudio.pause();
		currentAudio = null;
	}
	abortPlayback?.();
	abortPlayback = null;
}

export function isSpeaking(): boolean {
	return currentAudio !== null && !currentAudio.paused;
}

/**
 * Speak text via OpenAI TTS endpoint.
 * Falls back to Web Speech API if the network call fails.
 * Resolves when audio finishes OR when stopSpeaking() is called.
 */
export async function speakText(text: string): Promise<void> {
	stopSpeaking();

	try {
		const res = await fetch('/api/tts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text })
		});

		if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

		const blob = await res.blob();
		const url = URL.createObjectURL(blob);
		const audio = new Audio(url);
		currentAudio = audio;

		await new Promise<void>((resolve) => {
			const finish = () => {
				URL.revokeObjectURL(url);
				currentAudio = null;
				abortPlayback = null;
				resolve();
			};
			abortPlayback = finish;
			audio.onended = finish;
			audio.onerror = finish;
			audio.play().catch(finish);
		});
	} catch {
		// Fallback: Web Speech API
		fallbackSpeak(text);
	}
}

function fallbackSpeak(text: string) {
	if (!('speechSynthesis' in window)) return;
	window.speechSynthesis.cancel();
	const utt = new SpeechSynthesisUtterance(text);
	utt.rate = 1.0;
	window.speechSynthesis.speak(utt);
}
