let currentAudio: HTMLAudioElement | null = null;

/** Stop any currently playing TTS. */
export function stopSpeaking() {
	if (currentAudio) {
		currentAudio.pause();
		currentAudio = null;
	}
}

/**
 * Speak text via OpenAI TTS endpoint.
 * Falls back to Web Speech API if the network call fails.
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
			audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
			audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; resolve(); };
			audio.play().catch(() => resolve());
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
