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
	therapistGenderPref?: 'male' | 'female' | 'no_preference';
	language?: 'en' | 'zh';
}

export interface AgentResult {
	success: boolean;
	reply: string;
	data?: unknown;
}

// Small localization helper for agent-composed replies.
const L = (lang: 'en' | 'zh' | undefined, zh: string, en: string): string => (lang === 'zh' ? zh : en);

export async function handleBookingIntent(intent: BookingIntent): Promise<AgentResult> {
	if (intent.service === 'spa') return handleSpaBooking(intent);
	return handleGenericBooking(intent);
}

// ── SPA: uses the refactored spa MCP (list / availability / create with ok+slots) ──

interface SpaSlot {
	time: string;
	isAvailable: boolean;
}

async function handleSpaBooking(intent: BookingIntent): Promise<AgentResult> {
	const lang = intent.language;

	if (!intent.serviceId || !intent.date || !intent.time) {
		return {
			success: false,
			reply: L(
				lang,
				'好的，请告诉我想预约哪项 SPA、以及具体的日期和时间。',
				"Sure — please tell me which spa treatment, and the date and time you'd like."
			)
		};
	}

	// 1. Check real availability and USE the result.
	const avail = await callMcpTool({
		server: 'spa',
		tool: 'check_spa_availability',
		params: { service_id: intent.serviceId, date: intent.date }
	});
	if (!avail.success) {
		return {
			success: false,
			reply: L(lang, '暂时查不到 SPA 档期，请稍后再试。', "I couldn't check spa availability right now — please try again.")
		};
	}

	const slots = (avail.data as { slots?: SpaSlot[] })?.slots ?? [];
	const freeTimes = slots.filter((s) => s.isAvailable).map((s) => s.time);
	const chosen = slots.find((s) => s.time === intent.time);

	if (!chosen || !chosen.isAvailable) {
		const list = freeTimes.join(', ') || L(lang, '（当天暂无可预约时段）', '(no open times that day)');
		return {
			success: false,
			reply: L(
				lang,
				`${intent.time} 这个时段约不到了。当天可选：${list}。`,
				`${intent.time} isn't available. Open times that day: ${list}.`
			),
			data: { availableSlots: freeTimes }
		};
	}

	// 2. Create the booking (spa MCP validates again and returns ok/reason).
	const book = await callMcpTool({
		server: 'spa',
		tool: 'create_spa_booking',
		params: {
			service_id: intent.serviceId,
			room_id: intent.roomId,
			date: intent.date,
			time: intent.time,
			therapist_gender_preference: intent.therapistGenderPref ?? 'no_preference',
			notes: intent.notes ?? ''
		}
	});
	if (!book.success) {
		return {
			success: false,
			reply: L(lang, '预约没成功，请换个时间或联系前台。', "The booking didn't go through — please try another time or contact reception.")
		};
	}

	const res = book.data as {
		ok?: boolean;
		confirmationCode?: string;
		availableSlots?: string[];
		reason?: string;
	};

	if (res?.ok && res.confirmationCode) {
		return {
			success: true,
			reply: L(
				lang,
				`已为您预约 ${intent.date} ${intent.time} 的 SPA，确认码 ${res.confirmationCode}。稍后前台会与您确认。`,
				`Your spa on ${intent.date} at ${intent.time} is booked — confirmation code ${res.confirmationCode}. The desk will confirm with you shortly.`
			),
			data: res
		};
	}

	// Slot was taken between check and create.
	const list = (res?.availableSlots ?? freeTimes).join(', ') || L(lang, '（暂无可选）', '(none available)');
	return {
		success: false,
		reply: L(
			lang,
			`抱歉，这个时段刚被占用了。当天可选：${list}。`,
			`Sorry, that slot was just taken. Open times that day: ${list}.`
		),
		data: res
	};
}

// ── Restaurant / Transport: existing generic flow (their MCPs are unchanged) ──

const serverMap: Record<'restaurant' | 'transport', McpServerName> = {
	restaurant: 'restaurant',
	transport: 'transport'
};

const availabilityToolMap: Record<'restaurant' | 'transport', string> = {
	restaurant: 'check_table_availability',
	transport: 'get_transport_options'
};

const bookingToolMap: Record<'restaurant' | 'transport', string> = {
	restaurant: 'reserve_table',
	transport: 'book_transport'
};

async function handleGenericBooking(intent: BookingIntent): Promise<AgentResult> {
	const svc = intent.service as 'restaurant' | 'transport';
	const lang = intent.language;
	const server = serverMap[svc];

	const availResult = await callMcpTool({
		server,
		tool: availabilityToolMap[svc],
		params: { service_id: intent.serviceId, date: intent.date, party_size: intent.partySize }
	});
	if (!availResult.success) {
		return {
			success: false,
			reply: L(lang, `暂时查不到${svc === 'restaurant' ? '餐厅' : '交通'}的可用情况，请稍后再试。`, `Could not check availability for ${svc}. Please try again.`)
		};
	}

	const bookResult = await callMcpTool({
		server,
		tool: bookingToolMap[svc],
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
		return {
			success: false,
			reply: L(lang, '预约没成功，请换个时间或联系前台。', 'Booking failed. Please try a different time or contact reception.')
		};
	}

	const booking = bookResult.data as { confirmationCode?: string };
	return {
		success: true,
		reply: L(
			lang,
			`预约成功！确认码：${booking.confirmationCode ?? '—'}。`,
			`Your ${svc} booking is confirmed! Confirmation code: ${booking.confirmationCode ?? '—'}.`
		),
		data: bookResult.data
	};
}
