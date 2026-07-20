// SpaRepo — the stable data-access contract the MCP tools depend on.
// Swap the implementation (mock <-> Cakrasoft DB) behind this interface without
// touching tools.ts, the agents, or the tablet frontend.
//
//   SPA_DATA_SOURCE=db   -> dbRepo   (real Cakrasoft MySQL via @allstay/shared)
//   (default / anything) -> mockRepo (in-memory fixtures)

import { SPA_SERVICES, type SpaService } from './fixtures.js';

export interface SpaSlot {
	time: string;
	isAvailable: boolean;
}

export interface CreateBookingInput {
	serviceId: string;
	roomId: string;
	date: string;
	time: string;
	therapistGenderPref?: 'male' | 'female' | 'no_preference';
	notes?: string;
}

export type CreateBookingResult =
	| { ok: true; confirmationCode: string; serviceId: string; roomId: string; date: string; time: string }
	| { ok: false; reason: string; availableSlots: string[] };

export interface SpaRepo {
	listServices(filter?: { keyword?: string; category?: string }): Promise<SpaService[]>;
	getService(id: string): Promise<SpaService | null>;
	getAvailability(serviceId: string, date: string): Promise<SpaSlot[]>;
	createBooking(input: CreateBookingInput): Promise<CreateBookingResult>;
	cancelBooking(bookingId: string): Promise<{ ok: boolean }>;
}

// ── Mock implementation ─────────────────────────────────────────────────────

const BASE_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

// Module-level state: persists across requests within the running MCP process.
const takenSlots = new Map<string, Set<string>>(); // `${serviceId}|${date}` -> times
const bookings = new Map<string, { serviceId: string; date: string; time: string; roomId: string }>();

function slotKey(serviceId: string, date: string): string {
	return `${serviceId}|${date}`;
}

// Deterministic pseudo-random so the same (service,date,time) is always the same.
function stableHash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h;
}

export const mockRepo: SpaRepo = {
	async listServices(filter) {
		let list = SPA_SERVICES;
		if (filter?.category) list = list.filter((s) => s.category === filter.category);
		if (filter?.keyword) {
			const k = filter.keyword.toLowerCase();
			list = list.filter(
				(s) =>
					s.nameEn.toLowerCase().includes(k) ||
					s.nameZh.includes(filter.keyword!) ||
					s.nameId.toLowerCase().includes(k)
			);
		}
		return list;
	},

	async getService(id) {
		return SPA_SERVICES.find((s) => s.id === id) ?? null;
	},

	async getAvailability(serviceId, date) {
		const taken = takenSlots.get(slotKey(serviceId, date)) ?? new Set<string>();
		return BASE_TIMES.map((time) => ({
			time,
			// ~1 in 4 slots is pre-booked by "other guests", plus anything booked this session.
			isAvailable: !taken.has(time) && stableHash(`${serviceId}${date}${time}`) % 4 !== 0
		}));
	},

	async createBooking(input) {
		const service = SPA_SERVICES.find((s) => s.id === input.serviceId);
		if (!service) {
			return { ok: false, reason: `unknown service: ${input.serviceId}`, availableSlots: [] };
		}

		const slots = await mockRepo.getAvailability(input.serviceId, input.date);
		const chosen = slots.find((s) => s.time === input.time);
		if (!chosen || !chosen.isAvailable) {
			return {
				ok: false,
				reason: chosen ? `slot ${input.time} is not available` : `invalid time: ${input.time}`,
				availableSlots: slots.filter((s) => s.isAvailable).map((s) => s.time)
			};
		}

		const key = slotKey(input.serviceId, input.date);
		const taken = takenSlots.get(key) ?? new Set<string>();
		taken.add(input.time);
		takenSlots.set(key, taken);

		const confirmationCode = `SPA-${Date.now().toString(36).toUpperCase()}`;
		bookings.set(confirmationCode, {
			serviceId: input.serviceId,
			date: input.date,
			time: input.time,
			roomId: input.roomId
		});

		return {
			ok: true,
			confirmationCode,
			serviceId: input.serviceId,
			roomId: input.roomId,
			date: input.date,
			time: input.time
		};
	},

	async cancelBooking(bookingId) {
		const rec = bookings.get(bookingId);
		if (!rec) return { ok: false };
		const taken = takenSlots.get(slotKey(rec.serviceId, rec.date));
		taken?.delete(rec.time);
		bookings.delete(bookingId);
		return { ok: true };
	}
};

// ── DB implementation (stub) ────────────────────────────────────────────────
// When the real Cakrasoft MySQL is reachable, implement these with
// `query()` from '@allstay/shared/database.js'. Example query is shown in comments.

export const dbRepo: SpaRepo = {
	async listServices() {
		// return query<SpaService>('SELECT * FROM spa_services WHERE is_active = 1');
		throw new Error('dbRepo not implemented yet — set SPA_DATA_SOURCE=mock');
	},
	async getService() {
		throw new Error('dbRepo not implemented yet — set SPA_DATA_SOURCE=mock');
	},
	async getAvailability() {
		throw new Error('dbRepo not implemented yet — set SPA_DATA_SOURCE=mock');
	},
	async createBooking() {
		throw new Error('dbRepo not implemented yet — set SPA_DATA_SOURCE=mock');
	},
	async cancelBooking() {
		throw new Error('dbRepo not implemented yet — set SPA_DATA_SOURCE=mock');
	}
};

export const spaRepo: SpaRepo = process.env.SPA_DATA_SOURCE === 'db' ? dbRepo : mockRepo;
