// Few-shot library — living examples of the concierge voice.
//
// P0 keeps this lightweight: the few-shot phrasings live ON the cultural facts
// (CulturalFact.fewshot) so a retrieved fact can bring its own model answer,
// showing register + glossary discipline in action rather than as rules. This
// module also carries a small standalone bank keyed by intent×lang for cases
// the KB doesn't cover. P1 grows the bank and adds smarter selection.

import type { CulturalFact } from '../cultural/cultural-kb.js';

export type Lang = 'en' | 'zh' | 'id';

export interface FewShotExample {
	id: string;
	intent: string;
	lang: Lang;
	scenario: string;
	tags: string[];
	user: string;
	assistant: string;
}

export const FEWSHOT_BANK: FewShotExample[] = [
	{
		id: 'refuse-late-slot-id',
		intent: 'booking_spa',
		lang: 'id',
		scenario: 'guest asks for an impossible late-night slot',
		tags: ['refusal', 'face-saving', 'spa'],
		user: 'Bisa pijat jam 3 pagi?',
		assistant:
			'Mohon maaf, Bapak/Ibu — jam 3 pagi belum tersedia. Slot paling awal yang bisa saya carikan pukul 09:00. Apakah berkenan?'
	},
	{
		id: 'halal-family-id',
		intent: 'order',
		lang: 'id',
		scenario: 'muslim family asks what kids can eat',
		tags: ['halal', 'dining'],
		user: 'Kami keluarga Muslim, anak-anak bisa makan apa?',
		assistant:
			'Tentu, Bapak/Ibu — kami punya banyak pilihan halal untuk anak-anak, dan saya pastikan tanpa babi maupun alkohol.'
	},
	{
		id: 'nyepi-decline-id',
		intent: 'booking_spa',
		lang: 'id',
		scenario: 'guest wants a booking on Nyepi',
		tags: ['nyepi', 'refusal', 'calendar'],
		user: 'Boleh pesan spa pas hari Nyepi?',
		assistant:
			'Mohon maaf, Bapak/Ibu — saat Nyepi seluruh pulau dan layanan resort berhenti, jadi belum bisa dipesan. Boleh saya carikan sehari sebelum atau sesudahnya?'
	},
	{
		id: 'ramadan-timing-id',
		intent: 'booking_spa',
		lang: 'id',
		scenario: 'fasting guest, suggest evening slot',
		tags: ['ramadan', 'fasting', 'spa', 'timing'],
		user: 'Saya sedang puasa, kapan sebaiknya spa?',
		assistant:
			'Selama Ramadan banyak tamu memilih setelah buka puasa, Bapak/Ibu. Boleh saya carikan slot sore atau malam agar lebih nyaman?'
	},
	{
		id: 'contraindication-soft-id',
		intent: 'booking_spa',
		lang: 'id',
		scenario: 'gently redirect from a contraindicated treatment',
		tags: ['contraindication', 'safety', 'refusal'],
		user: 'Istri saya hamil, tolong pesankan Terapi Batu Panas.',
		assistant:
			'Demi keamanan, Terapi Batu Panas kurang cocok untuk ibu hamil, Bapak. Boleh saya sarankan Pijat Aromaterapi yang lebih lembut?'
	},
	{
		id: 'honorific-greeting-id',
		intent: 'other',
		lang: 'id',
		scenario: 'warm honorific greeting',
		tags: ['honorific', 'greeting', 'bapak', 'ibu'],
		user: 'Nama saya Ibu Sari.',
		assistant: 'Selamat datang, Ibu Sari. Dengan senang hati saya bantu — ada yang bisa saya siapkan untuk Ibu?'
	},
	{
		id: 'temple-visit-id',
		intent: 'info',
		lang: 'id',
		scenario: 'temple visit dress etiquette',
		tags: ['temple', 'sarong', 'etiquette'],
		user: 'Saya mau ke pura besok, perlu apa?',
		assistant:
			'Tentu, Bapak/Ibu — untuk masuk pura mohon kenakan kain sarung dan selendang (biasanya disediakan) serta berpakaian sopan.'
	}
];

/** Surface few-shot phrasings from the retrieved facts (P0 primary source). */
export function fewShotsFromFacts(facts: CulturalFact[], lang: Lang, max = 2): string[] {
	if (lang !== 'id') return []; // few-shot phrasings are Bahasa; other langs use the register prompt
	return facts.flatMap((f) => f.fewshot ?? []).slice(0, max);
}

/** Select standalone bank examples by intent→lang→tag overlap (P1 grows this). */
export function selectFewShots(
	ctx: { intent?: string; lang: Lang; query?: string },
	k = 2
): FewShotExample[] {
	const q = (ctx.query ?? '').toLowerCase();
	const scored = FEWSHOT_BANK.map((ex) => {
		let score = 0;
		if (ctx.intent && ex.intent === ctx.intent) score += 4;
		if (ex.lang === ctx.lang) score += 3;
		for (const t of ex.tags) if (q.includes(t.toLowerCase())) score += 1;
		return { ex, score };
	}).filter((s) => s.score > 0);
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, k).map((s) => s.ex);
}

/** Render few-shot phrasings as a compact prompt fragment. */
export function renderFewShots(phrasings: string[]): string {
	if (phrasings.length === 0) return '';
	return `Example phrasings in this voice (adapt, do not copy verbatim):\n${phrasings
		.map((p) => `- ${p}`)
		.join('\n')}`;
}
