import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';

export const GET: RequestHandler = async ({ url }) => {
	const serviceId = url.searchParams.get('serviceId');
	const date = url.searchParams.get('date');

	const result = await callMcpTool({
		server: 'spa',
		tool: 'check_spa_availability',
		params: { service_id: serviceId, date }
	});

	if (!result.success) throw error(500, result.error ?? 'Failed to fetch spa availability');
	return json(result.data);
};
