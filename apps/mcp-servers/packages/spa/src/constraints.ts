// Server-side constraint gate — the FINAL, client-independent safety check.
//
// The tablet already validates before proposing (see the tablet's
// lib/ai/constraints). This is a deliberately SEPARATE, minimal copy of the
// safety-critical rules so the MCP server never writes a booking that violates
// them — even if a buggy or malicious client calls create_spa_booking directly.
// Defense in depth: the server does not trust the client.
//
// Kept intentionally small and dependency-free (no import from the tablet app).

// Nyepi dates — the island pauses; no booking may be written on these days.
// Source: published Bali Saka calendar. Verify yearly before real deployment.
const NYEPI_DATES = new Set(['2025-03-29', '2026-03-19', '2027-03-08', '2028-02-26']);

export interface ServerBookingGuardInput {
	date: string;
	time?: string;
	contraindications: string[];
	maxPartySize?: number;
	partySize?: number;
	pregnant?: boolean;
	guestConditions?: string[];
}

export type GuardResult = { ok: true } | { ok: false; code: string; reason: string };

const CONDITION_ALIASES: Array<{ canonical: string; match: string[] }> = [
	{ canonical: 'pregnancy', match: ['pregnan', '怀孕', '孕', 'hamil'] },
	{ canonical: 'high blood pressure', match: ['high blood pressure', 'hypertens', '高血压', 'darah tinggi'] },
	{ canonical: 'diabetes', match: ['diabet', '糖尿', 'kencing manis'] },
	{ canonical: 'recent injury or surgery', match: ['injury', 'surgery', 'operation', '受伤', '手术', 'cedera', 'operasi'] }
];

function normalize(conditions: string[]): string[] {
	const out = new Set<string>();
	for (const item of conditions) {
		const s = (item ?? '').toLowerCase();
		for (const { canonical, match } of CONDITION_ALIASES) {
			if (match.some((m) => s.includes(m.toLowerCase()))) out.add(canonical);
		}
		out.add(s); // also keep the raw token for loose allergy matching
	}
	return [...out];
}

function normalizeDate(s: string): string {
	const m = (s ?? '').trim().match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
	if (!m) return (s ?? '').trim();
	return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

export function guardBooking(input: ServerBookingGuardInput): GuardResult {
	// 1. Nyepi — client-independent hard block (date is authoritative).
	if (NYEPI_DATES.has(normalizeDate(input.date))) {
		return { ok: false, code: 'nyepi', reason: 'Bookings are not permitted on Nyepi (Day of Silence).' };
	}

	// 2. Contraindications — validate whatever guest profile the client declared.
	const tokens = normalize([...(input.guestConditions ?? []), ...(input.pregnant ? ['pregnancy'] : [])]);
	for (const contra of input.contraindications ?? []) {
		const c = contra.toLowerCase();
		if (tokens.some((t) => t.includes(c) || c.includes(t))) {
			return { ok: false, code: 'contraindication', reason: `Contraindicated for the guest: ${contra}.` };
		}
	}

	// 3. Party size.
	if (
		typeof input.maxPartySize === 'number' &&
		typeof input.partySize === 'number' &&
		input.partySize > input.maxPartySize
	) {
		return { ok: false, code: 'party_size', reason: `Exceeds max party size of ${input.maxPartySize}.` };
	}

	return { ok: true };
}
