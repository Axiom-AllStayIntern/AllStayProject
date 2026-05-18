import { callMcpTool } from '../tools/mcp-client.js';
import type { McpServerName } from '../tools/mcp-client.js';

export type BookingService = 'spa' | 'restaurant' | 'transport';

export interface BookingIntent {
	service: BookingService;
	serviceId?: string;
	roomId: string;
	date?: string;
	time?: string;
	partySize?: number;
	notes?: string;
}

export interface AgentResult {
	success: boolean;
	reply: string;
	data?: unknown;
}

const serverMap: Record<BookingService, McpServerName> = {
	spa: 'spa',
	restaurant: 'restaurant',
	transport: 'transport'
};

const availabilityToolMap: Record<BookingService, string> = {
	spa: 'check_spa_availability',
	restaurant: 'check_table_availability',
	transport: 'get_transport_options'
};

const bookingToolMap: Record<BookingService, string> = {
	spa: 'create_spa_booking',
	restaurant: 'reserve_table',
	transport: 'book_transport'
};

export async function handleBookingIntent(intent: BookingIntent): Promise<AgentResult> {
	const server = serverMap[intent.service];

	// Check availability
	const availResult = await callMcpTool({
		server,
		tool: availabilityToolMap[intent.service],
		params: {
			service_id: intent.serviceId,
			date: intent.date,
			party_size: intent.partySize
		}
	});

	if (!availResult.success) {
		return { success: false, reply: `Could not check availability for ${intent.service}. Please try again.` };
	}

	// Create booking
	const bookResult = await callMcpTool({
		server,
		tool: bookingToolMap[intent.service],
		params: {
			service_id: intent.serviceId,
			room_id: intent.roomId,
			date: intent.date,
			time: intent.time,
			party_size: intent.partySize,
			notes: intent.notes
		}
	});

	if (!bookResult.success) {
		return { success: false, reply: 'Booking failed. Please try a different time or contact reception.' };
	}

	const booking = bookResult.data as { confirmationCode: string };
	return {
		success: true,
		reply: `Your ${intent.service} booking is confirmed! Confirmation code: ${booking.confirmationCode}`,
		data: bookResult.data
	};
}
