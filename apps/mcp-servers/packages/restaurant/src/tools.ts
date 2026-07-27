import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { query } from '@allstay/shared/database.js';

export function registerTools(server: McpServer) {
	server.tool(
		'get_restaurants',
		'List all hotel restaurants with their details and opening hours',
		{},
		async () => {
			const restaurants = await query('SELECT * FROM restaurants WHERE is_active = 1');
			return { content: [{ type: 'text', text: JSON.stringify({ restaurants }) }] };
		}
	);

	server.tool(
		'check_table_availability',
		'Check if a table is available at a restaurant for a given date, time and party size',
		{
			restaurant_id: z.string(),
			date: z.string(),
			time: z.string(),
			party_size: z.number().int().min(1).max(20)
		},
		async (args) => {
			// TODO: query reservation table for conflicts
			return { content: [{ type: 'text', text: JSON.stringify({ isAvailable: true, ...args }) }] };
		}
	);

	server.tool(
		'reserve_table',
		'Create a restaurant table reservation for a guest',
		{
			restaurant_id: z.string(),
			room_id: z.string(),
			date: z.string(),
			time: z.string(),
			party_size: z.number().int().min(1),
			dietary_requirements: z.string().optional(),
			notes: z.string().optional()
		},
		async (args) => {
			const confirmationCode = `RST-${Date.now().toString(36).toUpperCase()}`;
			// TODO: INSERT into Cakrasoft PMS reservations table
			return {
				content: [{
					type: 'text',
					text: JSON.stringify({ success: true, confirmationCode, ...args })
				}]
			};
		}
	);
}
