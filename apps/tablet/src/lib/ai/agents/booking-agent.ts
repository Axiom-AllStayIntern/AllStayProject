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
	language?: 'en' | 'zh' | 'id';
}

export interface AgentResult {
	success: boolean;
	reply: string;
	data?: unknown;
}

// Small localization helper for agent-composed replies. `id` (Bahasa Indonesia)
// is optional per string; when omitted it falls back to English.
type Lang = 'en' | 'zh' | 'id' | undefined;
const L = (lang: Lang, zh: string, en: string, id?: string): string =>
	lang === 'zh' ? zh : lang === 'id' ? (id ?? en) : en;

export async function handleBookingIntent(intent: BookingIntent): Promise<AgentResult> {
	// SPA uses a two-step flow (propose → confirm). Keep the generic direct-book
	// path for restaurant / transport whose MCPs are unchanged.
	if (intent.service === 'spa') return proposeSpaBooking(intent);
	return handleGenericBooking(intent);
}

// ── SPA: step 1 — propose (validate + ask to confirm, DOES NOT book) ─────────

interface SpaSlot {
	time: string;
	isAvailable: boolean;
}

async function getSpaServiceName(serviceId: string, lang: Lang): Promise<string> {
	const r = await callMcpTool({ server: 'spa', tool: 'get_spa_service', params: { service_id: serviceId } });
	const svc = (r.data as { service?: { nameEn?: string; nameZh?: string; nameId?: string } })?.service;
	if (!svc) return serviceId;
	const localized = lang === 'zh' ? svc.nameZh : lang === 'id' ? svc.nameId : svc.nameEn;
	return localized ?? svc.nameEn ?? serviceId;
}

export async function proposeSpaBooking(intent: BookingIntent): Promise<AgentResult> {
	const lang = intent.language;

	if (!intent.serviceId) {
		return {
			success: false,
			reply: L(lang, '好的，请问您想预约哪一项 SPA 疗程？', 'Sure — which spa treatment would you like?', 'Baik, perawatan spa mana yang Anda inginkan?')
		};
	}
	if (!intent.date || !intent.time) {
		const name = await getSpaServiceName(intent.serviceId, lang);
		return {
			success: false,
			reply: L(
				lang,
				`好的，${name}。请告诉我想约哪天、几点？`,
				`Great — ${name}. What date and time would you like?`,
				`Baik, ${name}. Untuk tanggal dan jam berapa?`
			),
			data: { need: ['date', 'time'] }
		};
	}

	const avail = await callMcpTool({
		server: 'spa',
		tool: 'check_spa_availability',
		params: { service_id: intent.serviceId, date: intent.date }
	});
	if (!avail.success) {
		return {
			success: false,
			reply: L(lang, '暂时查不到 SPA 档期，请稍后再试。', "I couldn't check spa availability right now — please try again.", 'Maaf, saya belum bisa memeriksa ketersediaan spa saat ini — silakan coba lagi.')
		};
	}

	const slots = (avail.data as { slots?: SpaSlot[] })?.slots ?? [];
	const freeTimes = slots.filter((s) => s.isAvailable).map((s) => s.time);
	const chosen = slots.find((s) => s.time === intent.time);

	if (!chosen || !chosen.isAvailable) {
		const list = freeTimes.join(', ') || L(lang, '（当天暂无可预约时段）', '(no open times that day)', '(tidak ada jam tersedia hari itu)');
		return {
			success: false,
			reply: L(
				lang,
				`${intent.time} 这个时段约不到了。当天可选：${list}。`,
				`${intent.time} isn't available. Open times that day: ${list}.`,
				`${intent.time} tidak tersedia. Jam yang tersedia hari itu: ${list}.`
			),
			data: { availableSlots: freeTimes }
		};
	}

	// Available — ask the guest to confirm. NOTHING is booked yet.
	const name = await getSpaServiceName(intent.serviceId, lang);
	return {
		success: true,
		reply: L(
			lang,
			`我为您找到 ${intent.date} ${intent.time} 的 ${name}。需要我确认预约吗？`,
			`I found ${name} on ${intent.date} at ${intent.time}. Shall I confirm the booking?`,
			`Saya menemukan ${name} pada ${intent.date} pukul ${intent.time}. Konfirmasikan pemesanannya?`
		),
		data: { proposal: { serviceId: intent.serviceId, date: intent.date, time: intent.time } }
	};
}

// ── SPA: step 2 — confirm (actually creates the booking) ─────────────────────

export async function confirmSpaBooking(intent: BookingIntent): Promise<AgentResult> {
	const lang = intent.language;

	if (!intent.serviceId || !intent.date || !intent.time) {
		return {
			success: false,
			reply: L(lang, '还没有待确认的预约，请先告诉我疗程、日期和时间。', 'There is nothing to confirm yet — please tell me the treatment, date and time first.', 'Belum ada pemesanan untuk dikonfirmasi — mohon sebutkan perawatan, tanggal, dan jam dahulu.')
		};
	}

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
			reply: L(lang, '预约没成功，请换个时间或联系前台。', "The booking didn't go through — please try another time or contact reception.", 'Pemesanan gagal — silakan coba jam lain atau hubungi resepsionis.')
		};
	}

	const res = book.data as { ok?: boolean; confirmationCode?: string; availableSlots?: string[] };
	if (res?.ok && res.confirmationCode) {
		return {
			success: true,
			reply: L(
				lang,
				`已确认！${intent.date} ${intent.time} 的 SPA 预约，确认码 ${res.confirmationCode}。稍后前台会与您对接。`,
				`Confirmed! Your spa on ${intent.date} at ${intent.time} — confirmation code ${res.confirmationCode}. The desk will follow up shortly.`,
				`Terkonfirmasi! Spa Anda pada ${intent.date} pukul ${intent.time} — kode konfirmasi ${res.confirmationCode}. Resepsionis akan menindaklanjuti.`
			),
			data: res
		};
	}

	const list = (res?.availableSlots ?? []).join(', ') || L(lang, '（暂无可选）', '(none available)', '(tidak ada yang tersedia)');
	return {
		success: false,
		reply: L(
			lang,
			`抱歉，这个时段刚被占用了。当天可选：${list}。`,
			`Sorry, that slot was just taken. Open times that day: ${list}.`,
			`Maaf, jam itu baru saja terisi. Jam yang tersedia hari itu: ${list}.`
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
