import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';
import type { McpServerName } from '$lib/ai/tools/mcp-client.js';

const toolByService: Record<string, { server: McpServerName; tool: string }> = {
	spa: { server: 'spa', tool: 'create_spa_booking' },
	restaurant: { server: 'restaurant', tool: 'reserve_table' },
	transport: { server: 'transport', tool: 'book_transport' }
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { service, ...params } = body;

	const config = toolByService[service];
	if (!config) throw error(400, 'Unknown service type');

	const result = await callMcpTool({ ...config, params });
	if (!result.success) throw error(500, result.error ?? 'Booking failed');
	return json(result.data);
};
