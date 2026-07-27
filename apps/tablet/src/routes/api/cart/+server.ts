import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { action, roomId, itemId, quantity, specialInstructions } = body;

	const toolMap: Record<string, string> = {
		add: 'add_to_cart',
		update: 'update_cart_item',
		remove: 'update_cart_item'
	};

	const tool = toolMap[action];
	if (!tool) throw error(400, 'Invalid action');

	const result = await callMcpTool({
		server: 'dining',
		tool,
		params: { room_id: roomId, item_id: itemId, quantity, special_instructions: specialInstructions }
	});

	if (!result.success) throw error(500, result.error ?? 'Cart operation failed');
	return json(result.data);
};
