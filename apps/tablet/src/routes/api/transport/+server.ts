import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';

export const GET: RequestHandler = async () => {
	const result = await callMcpTool({
		server: 'transport',
		tool: 'get_transport_options',
		params: {}
	});
	if (!result.success) throw error(500, result.error ?? 'Failed to fetch transport options');
	return json(result.data);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const result = await callMcpTool({
		server: 'transport',
		tool: 'book_transport',
		params: body
	});
	if (!result.success) throw error(500, result.error ?? 'Transport booking failed');
	return json(result.data);
};
