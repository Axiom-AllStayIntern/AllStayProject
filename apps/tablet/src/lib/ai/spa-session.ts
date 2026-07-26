// Lightweight per-room SPA conversation state (server process memory).
//
// Two things we remember across turns of the same guest session:
//   1. lastRecommended — the treatment the concierge last recommended, so the
//      guest can say "book that one" / "就订这个" without renaming it.
//   2. pending — a booking being assembled + awaiting explicit confirmation
//      (the confirmation gate). Nothing is booked until it is confirmed.
//
// NOTE: this is in-memory (fine for a single running instance / demo). For
// multi-instance production, back it with Redis (the project already has
// @allstay/shared/redis) keyed by room.

import type { GuestProfile } from './constraints/index.js';

export interface PendingSpaBooking {
	serviceId?: string;
	date?: string;
	time?: string;
	/** true once availability was checked and the guest was asked to confirm. */
	awaitingConfirmation?: boolean;
	/** Guest health/faith profile, carried to the confirm step's server-side gate. */
	guest?: GuestProfile;
	partySize?: number;
	/** Carried to the confirm step so the staff work order is complete. */
	notes?: string;
	therapistGenderPref?: 'male' | 'female' | 'no_preference';
}

const lastRecommended = new Map<string, string>();
const pending = new Map<string, PendingSpaBooking>();
const guests = new Map<string, GuestProfile>();

function unionArr(a?: string[], b?: string[]): string[] | undefined {
	const merged = [...(a ?? []), ...(b ?? [])].filter(Boolean);
	return merged.length ? [...new Set(merged)] : undefined;
}

export const spaSession = {
	setLastRecommended(roomId: string, serviceId: string): void {
		lastRecommended.set(roomId, serviceId);
	},
	getLastRecommended(roomId: string): string | null {
		return lastRecommended.get(roomId) ?? null;
	},

	/** Accumulate guest health/faith facts across turns (defined wins; arrays unioned). */
	mergeGuest(roomId: string, patch: GuestProfile): GuestProfile {
		const cur = guests.get(roomId) ?? {};
		const next: GuestProfile = {
			pregnant: patch.pregnant ?? cur.pregnant,
			fasting: patch.fasting ?? cur.fasting,
			faith: patch.faith ?? cur.faith,
			conditions: unionArr(cur.conditions, patch.conditions),
			allergies: unionArr(cur.allergies, patch.allergies)
		};
		guests.set(roomId, next);
		return next;
	},
	getGuest(roomId: string): GuestProfile {
		return guests.get(roomId) ?? {};
	},

	getPending(roomId: string): PendingSpaBooking | null {
		return pending.get(roomId) ?? null;
	},
	/** Merge new fields into the pending booking (keeps previously-known fields). */
	mergePending(roomId: string, patch: PendingSpaBooking): PendingSpaBooking {
		const next = { ...(pending.get(roomId) ?? {}), ...stripUndefined(patch) };
		pending.set(roomId, next);
		return next;
	},
	clearPending(roomId: string): void {
		pending.delete(roomId);
	}
};

function stripUndefined<T extends object>(o: T): Partial<T> {
	return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
