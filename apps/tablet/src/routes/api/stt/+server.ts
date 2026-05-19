import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';

// Whisper-1 frequently hallucinates these strings for silence / background noise.
const HALLUCINATION_RE = [
	/thanks?\s+for\s+watching/i,
	/thank\s+you\s+for\s+watching/i,
	/please\s+(like|subscribe|share)/i,
	/don't\s+forget\s+to\s+(like|subscribe)/i,
	/subscribe\s+to\s+(my|our|the)\s+channel/i,
	/^\s*\.\s*$/,                    // lone period
	/^[\s!?.。，,]+$/,               // only punctuation
];

// Remove emoji (and other pictographic symbols) from a string.
function stripEmoji(text: string): string {
	return text
		.replace(/\p{Emoji_Presentation}/gu, '')
		.replace(/\p{Extended_Pictographic}/gu, '')
		.trim();
}

function isHallucination(text: string): boolean {
	const t = text.trim();
	if (!t) return true;
	if (HALLUCINATION_RE.some(re => re.test(t))) return true;
	// Reject if stripping emoji leaves nothing meaningful
	if (!stripEmoji(t)) return true;
	return false;
}

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw error(500, 'OPENAI_API_KEY is not configured');

	const formData = await request.formData();
	const audio = formData.get('audio');

	if (!audio || !(audio instanceof File)) throw error(400, 'No audio file provided');

	const openai = new OpenAI({ apiKey });

	try {
		// verbose_json lets Whisper auto-detect language and report it back
		const transcription = await openai.audio.transcriptions.create({
			file: audio,
			model: 'whisper-1',
			response_format: 'verbose_json'
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		// Map Whisper language names → app language codes
		const LANG_MAP: Record<string, 'en' | 'zh'> = {
			chinese: 'zh', cantonese: 'zh', mandarin: 'zh',
			english: 'en'
		};
		// Whisper occasionally hallucinates Japanese/Korean when given noise — discard those
		const detectedLang: string = transcription.language ?? '';
		if (detectedLang && !LANG_MAP[detectedLang]) {
			return json({ text: '', detected: 'en' });
		}
		const detected: 'en' | 'zh' = LANG_MAP[detectedLang] ?? 'en';

		const raw: string = transcription.text ?? '';

		// Discard hallucinations; strip emoji from legitimate text
		if (isHallucination(raw)) {
			return json({ text: '', detected });
		}

		return json({ text: stripEmoji(raw), detected });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Transcription failed';
		throw error(502, message);
	}
};
