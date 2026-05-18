import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import OpenAI from 'openai';

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) throw error(500, 'OPENAI_API_KEY is not configured');

	const { text } = (await request.json()) as { text: string };
	if (!text?.trim()) throw error(400, 'text is required');

	const openai = new OpenAI({ apiKey });

	try {
		const response = await openai.audio.speech.create({
			model: 'tts-1',
			voice: 'nova',       // warm, clear — works well for both EN and ZH
			input: text,
			response_format: 'mp3',
			speed: 1.0
		});

		const buffer = await response.arrayBuffer();
		return new Response(buffer, {
			headers: {
				'Content-Type': 'audio/mpeg',
				'Content-Length': String(buffer.byteLength),
				'Cache-Control': 'no-store'
			}
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'TTS failed';
		throw error(502, message);
	}
};
