// Incremental sentence extraction for streaming TTS.
//
// The LLM reply streams in cumulatively ("Hi", "Hi there", "Hi there. Shall…").
// As each COMPLETE sentence appears we want to hand it to TTS immediately, while
// leaving the still-growing tail alone. This tracks a `consumed` cursor so the
// caller only ever speaks each sentence once.
//
// Pure + stateless (cursor passed in/out) so it is trivially unit-testable.

// Sentence-ending punctuation across en / zh / id plus hard newlines.
// (zh/ja full-width 。！？ included; ellipsis handled by the trailing class.)
const SENTENCE_RE = /[^.!?。！？\n]*[.!?。！？\n]+/g;

const MIN_SENTENCE_LEN = 2;

export interface ChunkResult {
	/** Newly-completed sentences (trimmed), in order. */
	sentences: string[];
	/** New cursor — index in `full` up to which text has been consumed. */
	consumed: number;
}

/**
 * Extract sentences that have become COMPLETE in `full` since index `from`.
 * The trailing text after the last sentence-ending punctuation is left
 * unconsumed (it may still be growing).
 */
export function extractSentences(full: string, from: number): ChunkResult {
	const tail = full.slice(from);
	const sentences: string[] = [];
	let localConsumed = 0;

	SENTENCE_RE.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = SENTENCE_RE.exec(tail)) !== null) {
		const trimmed = m[0].trim();
		if (trimmed.length >= MIN_SENTENCE_LEN) sentences.push(trimmed);
		localConsumed = SENTENCE_RE.lastIndex;
	}

	return { sentences, consumed: from + localConsumed };
}
