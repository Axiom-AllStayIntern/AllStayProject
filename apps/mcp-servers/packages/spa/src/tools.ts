import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { query } from '@allstay/shared/database.js';

export function registerTools(server: McpServer) {
	server.tool(
		'check_spa_availability',
		'Check available time slots for a spa service on a given date',
		{
			service_id: z.string().optional(),
			date: z.string().optional()
		},
		async (args) => {
			// TODO: query Cakrasoft PMS for available therapist slots
			const slots = [
				{ time: '09:00', isAvailable: true },
				{ time: '10:00', isAvailable: true },
				{ time: '11:00', isAvailable: false },
				{ time: '14:00', isAvailable: true },
				{ time: '15:00', isAvailable: true },
				{ time: '16:00', isAvailable: true }
			];
			return { content: [{ type: 'text', text: JSON.stringify({ services: [], slots }) }] };
		}
	);

	server.tool(
		'create_spa_booking',
		'Create a spa booking for a guest',
		{
			service_id: z.string(),
			room_id: z.string(),
			date: z.string(),
			time: z.string(),
			therapist_gender_preference: z.enum(['male', 'female', 'no_preference']).optional(),
			notes: z.string().optional()
		},
		async (args) => {
			const confirmationCode = `SPA-${Date.now().toString(36).toUpperCase()}`;
			// TODO: INSERT into Cakrasoft PMS bookings table
			return {
				content: [{
					type: 'text',
					text: JSON.stringify({
						success: true,
						confirmationCode,
						...args
					})
				}]
			};
		}
	);

	server.tool(
		'cancel_spa_booking',
		'Cancel an existing spa booking',
		{ booking_id: z.string() },
		async ({ booking_id }) => {
			// TODO: UPDATE bookings SET status='cancelled' WHERE id=?
			return { content: [{ type: 'text', text: JSON.stringify({ success: true, bookingId: booking_id }) }] };
		}
	);
}
