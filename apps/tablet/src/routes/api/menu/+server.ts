import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';

export const GET: RequestHandler = async ({ url }) => {
	const category = url.searchParams.get('category');

	if (category) {
		const result = await callMcpTool({
			server: 'dining',
			tool: 'search_menu_items',
			params: { category_id: category }
		});
		return json(result.success ? result.data : { items: [] });
	}

	const result = await callMcpTool({
		server: 'dining',
		tool: 'search_menu_items',
		params: {}
	});

	return json(result.success ? result.data : { categories: [] });
};
