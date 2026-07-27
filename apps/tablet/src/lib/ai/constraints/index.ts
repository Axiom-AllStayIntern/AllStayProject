// Constraint validation layer — safety by code, not by prompt.
//
// A "prompt and pray" concierge tells the model "respect contraindications" and
// hopes. This layer makes the dangerous rules STRUCTURAL: a pregnant guest can
// never be booked into hot-stone therapy, a Nyepi date is hard-blocked, an
// overfull party is rejected — checked in code BEFORE anything is booked, and
// re-checked server-side so a malicious/confused client can't bypass it.
//
// The tablet uses the localized messages to compose a face-saving refusal; the
// MCP server ships its own minimal copy of the same rules as a final gate
// (see apps/mcp-servers/packages/spa/src/constraints.ts) — defense in depth,
// with no cross-app code dependency.

import { isNyepi, festivalOn, adjacentDates, type CulturalCalendar } from './calendar.js';

export type Lang = 'en' | 'zh' | 'id';

export interface GuestProfile {
	pregnant?: boolean;
	/** Free-text health conditions in any language; normalized internally. */
	conditions?: string[];
	allergies?: string[];
	faith?: 'muslim' | null;
	fasting?: boolean;
}

export interface BookingCandidate {
	serviceId: string;
	date?: string;
	time?: string;
	/** Plain-language flags from the catalogue (SpaService.contraindications). */
	contraindications: string[];
	maxPartySize?: number;
	partySize?: number;
}

export interface ConstraintViolation {
	code: 'contraindication' | 'halal' | 'nyepi' | 'slot' | 'party_size' | 'ramadan_timing';
	severity: 'block' | 'warn';
	message: { en: string; zh: string; id: string };
	suggestion?: { alternativeDates?: string[]; alternativeTimes?: string[] };
}

export interface ValidateContext {
	calendar?: CulturalCalendar;
}

export interface ValidateResult {
	ok: boolean;
	violations: ConstraintViolation[];
}

/** Localize a violation message for the guest's language. */
export function violationText(v: ConstraintViolation, lang: Lang): string {
	return v.message[lang] ?? v.message.en;
}

// ── Condition normalization ──────────────────────────────────────────────────
// Map zh/id/loose phrasings onto the canonical tokens used in fixtures.

const CONDITION_ALIASES: Array<{ canonical: string; match: string[] }> = [
	{ canonical: 'pregnancy', match: ['pregnan', '怀孕', '孕', 'hamil', 'mengandung'] },
	{ canonical: 'high blood pressure', match: ['high blood pressure', 'hypertens', '高血压', 'darah tinggi', 'hipertensi'] },
	{ canonical: 'diabetes', match: ['diabet', '糖尿', 'kencing manis'] },
	{ canonical: 'recent injury or surgery', match: ['injury', 'surgery', 'operation', '受伤', '手术', 'cedera', 'operasi'] },
	{ canonical: 'sunburn', match: ['sunburn', '晒伤', 'terbakar matahari'] },
	{ canonical: 'sensitive skin', match: ['sensitive skin', '敏感肌', '敏感皮', 'kulit sensitif'] },
	{ canonical: 'active skin infection', match: ['skin infection', '皮肤感染', 'infeksi kulit'] }
];

function normalizeConditions(raw: string[]): string[] {
	const out = new Set<string>();
	for (const item of raw) {
		const s = (item ?? '').toLowerCase();
		for (const { canonical, match } of CONDITION_ALIASES) {
			if (match.some((m) => s.includes(m.toLowerCase()))) out.add(canonical);
		}
	}
	return [...out];
}

/** Build the effective set of guest condition/allergy tokens to check. */
function guestConditionTokens(guest: GuestProfile): string[] {
	const raw = [...(guest.conditions ?? []), ...(guest.allergies ?? [])];
	const tokens = normalizeConditions(raw);
	if (guest.pregnant) tokens.push('pregnancy');
	// Allergies also matched loosely as free text (e.g. "essential-oil allergy").
	for (const a of guest.allergies ?? []) tokens.push((a ?? '').toLowerCase());
	return tokens;
}

function matchesContraindication(token: string, contraindication: string): boolean {
	const a = token.toLowerCase();
	const b = contraindication.toLowerCase();
	return a.includes(b) || b.includes(a);
}

// ── The validator ─────────────────────────────────────────────────────────────

export function validateBooking(
	candidate: BookingCandidate,
	guest: GuestProfile,
	ctx: ValidateContext = {}
): ValidateResult {
	const violations: ConstraintViolation[] = [];
	const calendar = ctx.calendar;

	// 1. Contraindications — hard block. This is the safety-critical rule.
	const tokens = guestConditionTokens(guest);
	for (const contra of candidate.contraindications ?? []) {
		const hit = tokens.find((t) => matchesContraindication(t, contra));
		if (hit) {
			violations.push({
				code: 'contraindication',
				severity: 'block',
				message: {
					en: `For your safety this treatment isn't suitable given ${contra}. May I suggest a gentler option?`,
					zh: `出于安全考虑，因${contra}此项疗程不适合您。我为您推荐更温和的选择好吗？`,
					id: `Demi keamanan Anda, perawatan ini kurang cocok karena ${contra}. Boleh saya sarankan pilihan yang lebih lembut?`
				}
			});
		}
	}

	// 2. Nyepi — hard block on the whole island.
	if (candidate.date && isNyepi(candidate.date, calendar)) {
		violations.push({
			code: 'nyepi',
			severity: 'block',
			message: {
				en: 'That date falls on Nyepi (Day of Silence) — the island and all resort services pause. May I book the day before or after?',
				zh: '那天是 Nyepi 静居日，全岛与度假村服务都会暂停。我为您改约前一天或后一天好吗？',
				id: 'Tanggal itu bertepatan dengan Nyepi — seluruh pulau dan layanan resort berhenti. Boleh saya jadwalkan sehari sebelum atau sesudahnya?'
			},
			suggestion: { alternativeDates: adjacentDates(candidate.date) }
		});
	}

	// 3. Festival — soft warn (services run, but expect crowds/limited staff).
	if (candidate.date) {
		const fest = festivalOn(candidate.date, calendar);
		if (fest) {
			violations.push({
				code: 'nyepi', // grouped under calendar-sensitivity; severity distinguishes it
				severity: 'warn',
				message: {
					en: `Note: ${fest} falls that day — temples and roads can be busy and some staff may be on leave.`,
					zh: `提示：那天是 ${fest}，寺庙和道路可能拥挤，部分员工可能休假。`,
					id: `Catatan: ${fest} jatuh pada hari itu — pura dan jalan bisa ramai dan sebagian staf mungkin cuti.`
				}
			});
		}
	}

	// 4. Party size — hard block when known and exceeded.
	if (
		typeof candidate.maxPartySize === 'number' &&
		typeof candidate.partySize === 'number' &&
		candidate.partySize > candidate.maxPartySize
	) {
		violations.push({
			code: 'party_size',
			severity: 'block',
			message: {
				en: `This treatment is for up to ${candidate.maxPartySize} guest(s). Shall I find something for your group size?`,
				zh: `此项疗程最多 ${candidate.maxPartySize} 位。我为您找适合你们人数的选择好吗？`,
				id: `Perawatan ini untuk maksimal ${candidate.maxPartySize} tamu. Boleh saya carikan yang sesuai jumlah rombongan Anda?`
			}
		});
	}

	// 5. Ramadan timing — soft warn (P0 lightweight; P1 uses sunset times).
	if (guest.fasting && candidate.time && hourOf(candidate.time) < 17) {
		violations.push({
			code: 'ramadan_timing',
			severity: 'warn',
			message: {
				en: 'Since you are fasting, an after-sunset slot may be more comfortable. Would you prefer an evening time?',
				zh: '您在斋戒期间，日落后的时段可能更舒适。要不要改到傍晚？',
				id: 'Karena Anda berpuasa, jadwal setelah magrib mungkin lebih nyaman. Apakah lebih suka jam sore/malam?'
			}
		});
	}

	const ok = !violations.some((v) => v.severity === 'block');
	return { ok, violations };
}

function hourOf(time: string): number {
	const m = (time ?? '').match(/(\d{1,2})[:.]?/);
	return m ? Number(m[1]) : 12;
}
