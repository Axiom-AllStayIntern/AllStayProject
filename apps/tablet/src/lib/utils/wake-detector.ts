// Phrases that should trigger the wake word, covering accent variations.
const WAKE_VARIANTS = [
	'hi sirui',    'hey sirui',   'hi si rui',   'hi siruey',
	'hi sir we',   'hi surui',    'hi xirui',    'hi cirui',
	'hi suirui',   'hi serrui',   'hi seruey',   'hi se rui',
	'hi xi rui',   'hi siriui',   'hi siruwei',  'hi sir rui',
	'嗨思瑞',       'hi 思瑞',      '嗨 思瑞',      '嗨sir瑞'
];

export function matchesWakeWord(raw: string): boolean {
	const lower = raw.toLowerCase().trim();
	if (WAKE_VARIANTS.some(v => lower.includes(v))) return true;

	// Fuzzy: "hi/hey" + second word starting with a sibilant consonant ≥ 3 chars
	// catches regional pronunciations like "hi Shiruei", "hey Xilui", etc.
	const words = lower.split(/\s+/);
	if (words.length >= 2 && (words[0] === 'hi' || words[0] === 'hey')) {
		const w = words[1];
		if (w.length >= 3 && /^[sxczš]/.test(w)) return true;
	}
	return false;
}

export interface WakeDetectorOptions {
	onWakeWord: () => void;
}

export class WakeDetector {
	private recognition: SpeechRecognition | null = null;
	private active = false;
	private readonly opts: WakeDetectorOptions;

	constructor(opts: WakeDetectorOptions) {
		this.opts = opts;
	}

	get isSupported(): boolean {
		return typeof window !== 'undefined' &&
			('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
	}

	start(): void {
		if (this.active || !this.isSupported) return;
		this.active = true;
		this.spawn();
	}

	private spawn(): void {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
		const r: SpeechRecognition = new SR();
		this.recognition = r;

		r.continuous = true;
		r.interimResults = true;
		r.maxAlternatives = 3;
		r.lang = 'en-US';

		r.onresult = (ev: SpeechRecognitionEvent) => {
			if (!this.active) return;
			for (let i = ev.resultIndex; i < ev.results.length; i++) {
				for (let j = 0; j < ev.results[i].length; j++) {
					if (matchesWakeWord(ev.results[i][j].transcript)) {
						this.opts.onWakeWord();
						return;
					}
				}
			}
		};

		// Auto-restart so detection runs indefinitely.
		r.onend = () => {
			if (this.active) setTimeout(() => { if (this.active) this.spawn(); }, 200);
		};

		r.onerror = () => { /* handled via onend restart */ };

		try { r.start(); } catch { /* already running */ }
	}

	stop(): void {
		this.active = false;
		try { this.recognition?.abort(); } catch { /* ok */ }
		this.recognition = null;
	}
}
