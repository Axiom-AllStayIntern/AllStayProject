// Text-to-speech with a SENTENCE-LEVEL streaming queue.
//
// Old behaviour: synthesize the whole reply, then play one clip — the guest
// watched text stream on screen but heard nothing until the full sentence was
// synthesized. New behaviour: the caller enqueues sentences AS they stream out
// of the LLM; each is synthesized and played in order, so speech begins after
// the first sentence. stopSpeaking() clears the queue + aborts the current clip
// (used for barge-in / session end).

let currentAudio:  HTMLAudioElement | null = null;
let abortPlayback: (() => void) | null = null;
let fetchAbort:    AbortController | null = null;

// ── Sentence queue ───────────────────────────────────────────────────────────
let speechQueue:  string[] = [];
let queuePlaying = false;
let drainWaiters: Array<() => void> = [];

/** Abort just the CURRENT clip (in-flight fetch, audio element, or Web Speech). */
function stopCurrentClip() {
	if (fetchAbort) { fetchAbort.abort(); fetchAbort = null; }
	if (currentAudio) { currentAudio.pause(); currentAudio = null; }
	abortPlayback?.();
	abortPlayback = null;
	if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
		window.speechSynthesis.cancel();
	}
}

function resolveDrainWaiters() {
	const waiters = drainWaiters;
	drainWaiters = [];
	queuePlaying = false;
	waiters.forEach((r) => r());
}

/** Stop everything: clear the pending queue AND abort the current clip. */
export function stopSpeaking() {
	speechQueue = [];
	stopCurrentClip();
	resolveDrainWaiters();
}

export function isSpeaking(): boolean {
	return queuePlaying || (currentAudio !== null && !currentAudio.paused) || !!fetchAbort;
}

/**
 * Enqueue one sentence to be spoken after everything already queued. Starts the
 * drain loop if idle. Returns immediately (non-blocking).
 */
export function enqueueSpeech(text: string): void {
	const t = text.trim();
	if (!t) return;
	speechQueue.push(t);
	if (!queuePlaying) void drainQueue();
}

async function drainQueue(): Promise<void> {
	queuePlaying = true;
	while (speechQueue.length > 0) {
		const next = speechQueue.shift()!;
		await speakOne(next);
	}
	resolveDrainWaiters();
}

/** Resolves once the queue has fully drained (or was stopped). */
export function waitForSpeechDrain(): Promise<void> {
	if (!queuePlaying && speechQueue.length === 0) return Promise.resolve();
	return new Promise((r) => drainWaiters.push(r));
}

/**
 * Speak a single piece of text as ONE clip (used by the goodbye path and by the
 * queue drain). Public speakText resets the queue first; the drain loop calls
 * speakOne directly so it doesn't wipe the sentences still waiting behind it.
 * Resolves when audio finishes OR when stopCurrentClip()/stopSpeaking() fires.
 */
function speakOne(text: string): Promise<void> {
	return new Promise<void>(async (resolve) => {
		// Register abort handler immediately — before any await —
		// so stopCurrentClip() can resolve this promise at any point.
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
				// Already resolved by stopCurrentClip via abortPlayback
				return;
			}
			// Network/parse error → try Web Speech fallback
			fallbackSpeak(text, resolve);
		}
	});
}

/**
 * Speak text as a single utterance, cancelling anything already playing/queued.
 * Kept for the goodbye/close-session path. Resolves when done or stopped.
 */
export async function speakText(text: string): Promise<void> {
	stopSpeaking();
	await speakOne(text);
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
