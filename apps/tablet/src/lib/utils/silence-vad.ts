export interface SilenceVADOptions {
	/** RMS amplitude (0–1) below which audio is considered silent. Default 0.015. */
	silenceThresholdRMS?: number;
	/** How long (ms) silence must persist after speech before firing. Default 2000. */
	silenceDurationMs?: number;
	/** RMS amplitude above which a frame counts as "voice". Default 0.02. */
	voiceThresholdRMS?: number;
	/** Safety cap: fire onTimeout if nothing resolved within this many ms. Default 15 000. */
	maxDurationMs?: number;

	/** Fired after the user speaks and then falls silent for silenceDurationMs. */
	onSilenceAfterVoice: () => void;
	/** Fired once the first frame above voiceThresholdRMS is detected. */
	onVoiceDetected?: () => void;
	/** Fired when maxDurationMs is reached without a silence event. */
	onTimeout?: () => void;
}

/**
 * Attaches a lightweight AnalyserNode-based VAD to a MediaStream.
 * Returns a cleanup function that stops the detector without firing any callbacks.
 */
export function attachSilenceVAD(stream: MediaStream, opts: SilenceVADOptions): () => void {
	const {
		silenceThresholdRMS = 0.015,
		silenceDurationMs   = 2_000,
		voiceThresholdRMS   = 0.02,
		maxDurationMs       = 15_000,
		onSilenceAfterVoice,
		onVoiceDetected,
		onTimeout
	} = opts;

	const ctx      = new AudioContext();
	const src      = ctx.createMediaStreamSource(stream);
	const analyser = ctx.createAnalyser();
	analyser.fftSize = 512;
	src.connect(analyser);

	const buf = new Float32Array(analyser.fftSize);
	let hasSpoken   = false;
	let silenceStart = 0;
	let raf          = 0;
	let finished     = false;

	const maxTimer = setTimeout(() => {
		if (finished) return;
		done();
		onTimeout?.();
	}, maxDurationMs);

	function rms(): number {
		analyser.getFloatTimeDomainData(buf);
		let s = 0;
		for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
		return Math.sqrt(s / buf.length);
	}

	function tick() {
		if (finished) return;
		const level = rms();

		if (level > voiceThresholdRMS) {
			if (!hasSpoken) {
				hasSpoken = true;
				onVoiceDetected?.();
			}
			silenceStart = 0;
		} else if (hasSpoken) {
			if (!silenceStart) silenceStart = Date.now();
			if (Date.now() - silenceStart >= silenceDurationMs) {
				done();
				onSilenceAfterVoice();
				return;
			}
		}

		raf = requestAnimationFrame(tick);
	}

	raf = requestAnimationFrame(tick);

	function done() {
		finished = true;
		clearTimeout(maxTimer);
		cancelAnimationFrame(raf);
		src.disconnect();
		ctx.close().catch(() => {});
	}

	return done;
}
