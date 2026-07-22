// Cultural calendar — the structured source of truth for date-sensitive rules.
//
// Bali's Saka calendar shifts every year, so Nyepi (Day of Silence) cannot be
// hard-coded as a fixed month/day. This small data map is the auditable source;
// update it yearly (or wire it to a real calendar service later). It exists so
// the constraint layer can HARD-BLOCK a Nyepi booking in code instead of hoping
// the model remembers the date.

export interface CulturalCalendar {
	/** ISO dates (YYYY-MM-DD) on which the island effectively pauses. */
	nyepi: string[];
	/** ISO dates of major ceremonies where services still run but may be busy. */
	festivals: Array<{ date: string; name: string }>;
}

// Source: published Bali Hindu Saka calendar (Nyepi observance).
// NOTE: verify against an official source each year before a real deployment.
export const CULTURAL_CALENDAR: CulturalCalendar = {
	nyepi: ['2025-03-29', '2026-03-19', '2027-03-08', '2028-02-26'],
	festivals: [
		{ date: '2026-04-15', name: 'Galungan' },
		{ date: '2026-04-25', name: 'Kuningan' }
	]
};

export function isNyepi(dateIso: string, calendar: CulturalCalendar = CULTURAL_CALENDAR): boolean {
	return calendar.nyepi.includes(normalizeDate(dateIso));
}

export function festivalOn(
	dateIso: string,
	calendar: CulturalCalendar = CULTURAL_CALENDAR
): string | null {
	const d = normalizeDate(dateIso);
	return calendar.festivals.find((f) => f.date === d)?.name ?? null;
}

/** Suggest the day before and after as alternatives to a blocked date. */
export function adjacentDates(dateIso: string): string[] {
	const d = parseIso(normalizeDate(dateIso));
	if (!d) return [];
	const before = new Date(d);
	before.setUTCDate(d.getUTCDate() - 1);
	const after = new Date(d);
	after.setUTCDate(d.getUTCDate() + 1);
	return [toIso(before), toIso(after)];
}

// ── date helpers (UTC, no locale surprises) ──────────────────────────────────

function normalizeDate(s: string): string {
	// Accept "2026-03-19", "2026/03/19", trailing time — keep the date part.
	const m = (s ?? '').trim().match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
	if (!m) return (s ?? '').trim();
	const [, y, mo, da] = m;
	return `${y}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

function parseIso(s: string): Date | null {
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toIso(d: Date): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
		d.getUTCDate()
	).padStart(2, '0')}`;
}
