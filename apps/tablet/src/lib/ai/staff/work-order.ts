// Staff work order — the "wrap, don't replace" bridge.
//
// After a spa booking is CONFIRMED, the concierge does the thinking/translating
// and hands the local (Indonesian-speaking) SPA desk a pre-filled, structured
// Bahasa ticket. The human just does the final low-risk keystroke into Cakrasoft.
// This module only BUILDS the ticket; notify.ts delivers it over channels.

import type { GuestProfile } from '../constraints/index.js';

export interface WorkOrderInput {
	confirmationCode: string;
	roomId: string;
	serviceId: string;
	/** Catalogue detail (from spa MCP get_spa_service) for the treatment name + contraindications. */
	service: { nameEn?: string; nameId?: string; contraindications?: string[] } | null;
	date: string;
	time: string;
	partySize?: number;
	therapistGenderPref?: 'male' | 'female' | 'no_preference';
	notes?: string;
	/** Guest health/faith profile — surfaced to the therapist as safety flags. */
	guest?: GuestProfile;
	/** Epoch ms; passed in so this stays pure/testable (no Date.now() inside). */
	createdAt: number;
}

export interface WorkOrder extends WorkOrderInput {
	treatmentNameId: string;
	treatmentNameEn: string;
	/** Therapist-facing safety flags in Bahasa (pregnancy, conditions, allergies). */
	guestFlags: string[];
	/** Rendered Bahasa ticket (what the desk reads / what gets printed). */
	bahasaText: string;
	/** Staff-side lifecycle for the /staff viewer. */
	status: 'pending' | 'confirmed';
}

const GENDER_ID: Record<string, string> = {
	male: 'Terapis pria',
	female: 'Terapis wanita',
	no_preference: 'Tanpa preferensi'
};

function buildGuestFlags(guest?: GuestProfile): string[] {
	const flags: string[] = [];
	if (guest?.pregnant) flags.push('Tamu sedang hamil');
	for (const c of guest?.conditions ?? []) if (c) flags.push(`Kondisi: ${c}`);
	for (const a of guest?.allergies ?? []) if (a) flags.push(`Alergi: ${a}`);
	if (guest?.fasting) flags.push('Tamu sedang berpuasa');
	return flags;
}

/** Build a structured Bahasa work order from a confirmed booking. Pure function. */
export function buildWorkOrder(input: WorkOrderInput): WorkOrder {
	const treatmentNameId = input.service?.nameId ?? input.service?.nameEn ?? input.serviceId;
	const treatmentNameEn = input.service?.nameEn ?? input.serviceId;
	const guestFlags = buildGuestFlags(input.guest);

	const lines = [
		'== PESANAN SPA BARU ==',
		`Kamar     : ${input.roomId}`,
		`Perawatan : ${treatmentNameId}`,
		`Tanggal   : ${input.date}`,
		`Jam       : ${input.time}`,
		`Jumlah    : ${input.partySize ?? 1} tamu`,
		`Terapis   : ${GENDER_ID[input.therapistGenderPref ?? 'no_preference']}`
	];
	if (input.notes) lines.push(`Catatan   : ${input.notes}`);
	if (guestFlags.length) lines.push(`Perhatian : ${guestFlags.join('; ')}`);
	lines.push(`Kode      : ${input.confirmationCode}`);
	lines.push('Mohon konfirmasi & masukkan ke Cakrasoft.');

	return {
		...input,
		treatmentNameId,
		treatmentNameEn,
		guestFlags,
		bahasaText: lines.join('\n'),
		status: 'pending'
	};
}
