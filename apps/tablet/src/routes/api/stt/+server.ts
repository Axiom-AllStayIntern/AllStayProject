import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';

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
		const detected: 'en' | 'zh' = LANG_MAP[transcription.language] ?? 'en';

		return json({ text: transcription.text as string, detected });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Transcription failed';
		throw error(502, message);
	}
};
