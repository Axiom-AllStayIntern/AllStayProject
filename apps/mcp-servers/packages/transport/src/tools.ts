import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const TRANSPORT_OPTIONS = [
	{ id: 'car-sedan', type: 'car', name: 'Private Car (Sedan)', description: 'Comfortable private car transfer', capacity: 3, price: 350000 },
	{ id: 'car-suv', type: 'car', name: 'Private SUV', description: 'Spacious SUV for families or groups', capacity: 6, price: 500000 },
	{ id: 'van-minivan', type: 'van', name: 'Minivan', description: 'Perfect for larger groups', capacity: 8, price: 650000 },
	{ id: 'shuttle-airport', type: 'shuttle', name: 'Airport Shuttle', description: 'Shared shuttle to/from airport', capacity: 10, price: 150000 }
];

export function registerTools(server: McpServer) {
	server.tool(
		'get_transport_options',
		'Get all available transport options with pricing',
		{},
		async () => {
			return { content: [{ type: 'text', text: JSON.stringify({ options: TRANSPORT_OPTIONS }) }] };
		}
	);

	server.tool(
		'book_transport',
		'Book a transport option for a guest',
		{
			option_id: z.string(),
			room_id: z.string(),
			pickup_date: z.string(),
			pickup_time: z.string(),
			pickup_location: z.string(),
			destination: z.string(),
			passenger_count: z.number().int().min(1),
			flight_number: z.string().optional(),
			notes: z.string().optional()
		},
		async (args) => {
			const confirmationCode = `TRN-${Date.now().toString(36).toUpperCase()}`;
			// TODO: INSERT into transport_bookings table, assign driver
			return {
				content: [{
					type: 'text',
					text: JSON.stringify({
						success: true,
						confirmationCode,
						driverName: 'Wayan Sari',
						driverPhone: '+62 812-3456-7890',
						...args
					})
				}]
			};
		}
	);

	server.tool(
		'cancel_transport',
		'Cancel a transport booking',
		{ booking_id: z.string() },
		async ({ booking_id }) => {
			// TODO: UPDATE transport_bookings SET status='cancelled' WHERE id=?
			return { content: [{ type: 'text', text: JSON.stringify({ success: true, bookingId: booking_id }) }] };
		}
	);
}
