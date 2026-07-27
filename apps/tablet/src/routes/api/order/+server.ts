import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json();
	const { items, notes } = body;

	if (!items?.length) throw error(400, 'Order must have at least one item');

	const result = await callMcpTool({
		server: 'dining',
		tool: 'place_order',
		params: {
			staff_id: locals.staffId,
			items,
			notes: notes ?? ''
		}
	});

	if (!result.success) throw error(500, result.error ?? 'Order failed');
	return json(result.data);
};
