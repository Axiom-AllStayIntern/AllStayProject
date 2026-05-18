import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw error(500, 'OPENAI_API_KEY is not configured');

	const formData = await request.formData();
	const audio = formData.get('audio');
	const lang = formData.get('language');

	if (!audio || !(audio instanceof File)) throw error(400, 'No audio file provided');

	const openai = new OpenAI({ apiKey });

	try {
		const transcription = await openai.audio.transcriptions.create({
			file: audio,
			model: 'whisper-1',
			language: typeof lang === 'string' ? lang : 'zh'
		});
		return json({ text: transcription.text });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Transcription failed';
		throw error(502, message);
	}
};
