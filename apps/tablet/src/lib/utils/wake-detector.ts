export function matchesWakeWord(raw: string): boolean {
	// "start" and common misrecognitions / near-homophones
	return /\bstart(s|ed|er|ing)?\b/i.test(raw.trim());
}

export interface WakeDetectorOptions {
	onWakeWord: () => void;
}

type WakeSpeechRecognitionAlternative = {
	transcript: string;
};

type WakeSpeechRecognitionResult = {
	readonly length: number;
	[index: number]: WakeSpeechRecognitionAlternative;
};

type WakeSpeechRecognitionResultList = {
	readonly length: number;
	[index: number]: WakeSpeechRecognitionResult;
};

type WakeSpeechRecognitionEvent = {
	readonly resultIndex: number;
	readonly results: WakeSpeechRecognitionResultList;
};

type WakeSpeechRecognition = {
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	lang: string;
	onresult: ((ev: WakeSpeechRecognitionEvent) => void) | null;
	onend: (() => void) | null;
	onerror: (() => void) | null;
	start: () => void;
	abort: () => void;
};

type WakeSpeechRecognitionConstructor = new () => WakeSpeechRecognition;

type SpeechRecognitionWindow = Window & {
	SpeechRecognition?: WakeSpeechRecognitionConstructor;
	webkitSpeechRecognition?: WakeSpeechRecognitionConstructor;
};

export class WakeDetector {
	private recognitions: WakeSpeechRecognition[] = [];
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
		this.spawn('en-US');
	}

	private spawn(lang: string): void {
		const speechWindow = window as SpeechRecognitionWindow;
		const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
		if (!SR) return;

		const r = new SR();
		this.recognitions.push(r);

		r.continuous      = true;
		r.interimResults  = true;
		r.maxAlternatives = 3;
		r.lang            = lang;

		r.onresult = (ev: WakeSpeechRecognitionEvent) => {
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

		r.onend = () => {
			const idx = this.recognitions.indexOf(r);
			if (idx !== -1) this.recognitions.splice(idx, 1);
			if (this.active) setTimeout(() => { if (this.active) this.spawn(lang); }, 200);
		};

		r.onerror = () => { /* handled via onend restart */ };

		try { r.start(); } catch { /* already running */ }
	}

	stop(): void {
		this.active = false;
		this.recognitions.forEach(r => { try { r.abort(); } catch { /* ok */ } });
		this.recognitions = [];
	}
}
