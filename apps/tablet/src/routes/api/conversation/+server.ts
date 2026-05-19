import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamConversation } from '$lib/ai/orchestrator.js';

const enc = new TextEncoder();
function sseChunk(data: object): Uint8Array {
	return enc.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { message, roomId, language, history } = body;

	if (!message || !roomId) {
		throw error(400, 'message and roomId are required');
	}

	const stream = new ReadableStream({
		async start(controller) {
			try {
				const result = await streamConversation(
					{ message, roomId, language: language ?? 'en', history: history ?? [] },
					(chunk) => controller.enqueue(sseChunk({ t: 'chunk', v: chunk }))
				);
				controller.enqueue(sseChunk({ t: 'done', ...result }));
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'AI service error';
				controller.enqueue(sseChunk({ t: 'error', message: msg }));
			}
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type':  'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection':    'keep-alive',
			'X-Accel-Buffering': 'no'   // disable nginx buffering if behind proxy
		}
	});
};
