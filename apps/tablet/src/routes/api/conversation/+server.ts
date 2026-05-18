import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processConversation } from '$lib/ai/orchestrator.js';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { message, roomId, language, history } = body;

	if (!message || !roomId) {
		throw error(400, 'message and roomId are required');
	}

	const result = await processConversation({
		message,
		roomId,
		language: language ?? 'en',
		history: history ?? []
	});

	return json(result);
};
