// Curated glossary — the terminology backbone of the localization layer.
//
// Purpose: keep culturally-loaded terms (halal, Nyepi, canang sari, honorifics …)
// CONSISTENT and UNDRIFTED across en/zh/id. A generic "translation agent" will
// happily render "Nyepi" as "Silent Day" or invent a Chinese word for canang
// sari; a concierge with domain sovereignty locks them to a canonical form.
//
// Two jobs:
//   1. selectGlossary/renderGlossary — inject the right canonical translations
//      into the prompt so the model uses them.
//   2. buildGlossaryLocks — emit machine-checkable locks so a downstream gate
//      (the LLM gateway's phrase pass) can VERIFY the reply kept the term and
//      fall back if a weaker model dropped or mistranslated it.

export type Lang = 'en' | 'zh' | 'id';

export type GlossaryDomain =
	| 'faith'
	| 'spa'
	| 'etiquette'
	| 'calendar'
	| 'dining'
	| 'general';

export interface GlossaryTerm {
	id: string;
	domain: GlossaryDomain;
	/** Match keywords (any language) that signal this term is relevant to a query. */
	tags: string[];
	/** The canonical rendering per language. */
	canonical: { en: string; zh: string; id: string };
	/** Colloquial / slang variants a guest might use (helps recognition, not output). */
	slang?: { id?: string[] };
	register?: 'formal' | 'casual';
	/** Proper nouns kept verbatim in every language (Nyepi, canang sari, iftar …). */
	doNotTranslate?: boolean;
	note?: string;
}

export interface GlossaryLock {
	termId: string;
	/** The substring the reply MUST contain for this language. */
	mustContain: string;
	lang: Lang;
}

// ── Seed glossary ───────────────────────────────────────────────────────────
// Focused on faith / calendar / etiquette terms where mistranslation is either
// offensive or factually wrong. Spa treatment names are resolved from the live
// catalogue (see resolveSpaServiceId), so they are intentionally not duplicated.

export const GLOSSARY: GlossaryTerm[] = [
	{
		id: 'halal',
		domain: 'faith',
		tags: ['halal', 'muslim', 'clean food', '清真', '穆斯林', 'islam'],
		canonical: { en: 'halal', zh: '清真 (halal)', id: 'halal' },
		doNotTranslate: true,
		note: 'Never render as "clean" or "Islamic food"; keep the word halal.'
	},
	{
		id: 'nyepi',
		domain: 'calendar',
		tags: ['nyepi', 'day of silence', 'silent day', '静居日', '安宁日', 'saka new year'],
		canonical: { en: 'Nyepi (Day of Silence)', zh: 'Nyepi 静居日', id: 'Nyepi' },
		doNotTranslate: true,
		note: 'Proper noun. Do not translate to a generic "silent day".'
	},
	{
		id: 'canang-sari',
		domain: 'etiquette',
		tags: ['canang', 'canang sari', 'offering', 'offerings', 'flower basket', '供品', '花供'],
		canonical: { en: 'canang sari (daily offerings)', zh: 'canang sari（每日供品）', id: 'canang sari' },
		doNotTranslate: true,
		note: 'Balinese Hindu daily offering. Keep the Balinese term.'
	},
	{
		id: 'galungan',
		domain: 'calendar',
		tags: ['galungan', 'penjor', '加隆安'],
		canonical: { en: 'Galungan', zh: 'Galungan（加隆安节）', id: 'Galungan' },
		doNotTranslate: true
	},
	{
		id: 'kuningan',
		domain: 'calendar',
		tags: ['kuningan', '库宁安'],
		canonical: { en: 'Kuningan', zh: 'Kuningan（库宁安节）', id: 'Kuningan' },
		doNotTranslate: true
	},
	{
		id: 'iftar',
		domain: 'faith',
		tags: ['iftar', 'break fast', 'after sunset', 'buka puasa', '开斋', '封斋'],
		canonical: { en: 'iftar (breaking of the fast after sunset)', zh: 'iftar（日落后开斋）', id: 'buka puasa (iftar)' },
		doNotTranslate: false,
		note: 'In Bahasa Indonesia prefer "buka puasa"; keep "iftar" recognizable.'
	},
	{
		id: 'ramadan',
		domain: 'faith',
		tags: ['ramadan', 'ramadhan', 'fasting month', '斋月', '斋戒'],
		canonical: { en: 'Ramadan', zh: 'Ramadan 斋月', id: 'Ramadan' },
		doNotTranslate: true
	},
	{
		id: 'honorific-bapak-ibu',
		domain: 'etiquette',
		tags: ['bapak', 'ibu', 'pak', 'bu', 'honorific', 'address', '先生', '女士', '称呼'],
		canonical: { en: 'Bapak/Ibu', zh: 'Bapak/Ibu（先生/女士）', id: 'Bapak/Ibu' },
		register: 'formal',
		doNotTranslate: true,
		note: 'Indonesian honorifics; keep when addressing guests/staff politely.'
	},
	{
		id: 'sarong-sash',
		domain: 'etiquette',
		tags: ['sarong', 'sash', 'selendang', 'kamen', 'temple dress', '纱笼', '腰带'],
		canonical: { en: 'sarong and sash', zh: 'sarong 纱笼与腰带 (sash)', id: 'kain sarung dan selendang' },
		note: 'Temple dress code items.'
	},
	{
		id: 'om-swastiastu',
		domain: 'etiquette',
		tags: ['om swastiastu', 'balinese greeting', 'hindu greeting'],
		canonical: { en: 'Om Swastiastu', zh: 'Om Swastiastu', id: 'Om Swastiastu' },
		doNotTranslate: true,
		note: 'Balinese Hindu greeting. Never translate.'
	}
];

// ── Retrieval + rendering ────────────────────────────────────────────────────

/** Pick glossary terms relevant to a query (keyword/tag overlap), optionally scoped to a domain. */
export function selectGlossary(query: string, _lang: Lang, domain?: GlossaryDomain, max = 4): GlossaryTerm[] {
	const q = (query ?? '').toLowerCase();
	if (!q.trim()) return [];

	const scored = GLOSSARY.filter((t) => !domain || t.domain === domain)
		.map((term) => {
			let score = 0;
			const surfaces = [...term.tags, ...(term.slang?.id ?? [])];
			for (const s of surfaces) {
				const t = s.toLowerCase();
				// CJK tags need substring match on the original (not lowercased-ASCII) query.
				if (q.includes(t) || query.includes(s)) score += t.length >= 4 ? 3 : 2;
			}
			return { term, score };
		})
		.filter((s) => s.score > 0);

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, max).map((s) => s.term);
}

/** Render selected terms as a prompt fragment instructing the model which wording to use. */
export function renderGlossary(terms: GlossaryTerm[], lang: Lang): string {
	if (terms.length === 0) return '';
	const lines = terms.map((t) => {
		const canonical = t.canonical[lang];
		const dnt = t.doNotTranslate ? ' [keep verbatim, do not translate]' : '';
		const note = t.note ? ` — ${t.note}` : '';
		return `- ${t.id}: use "${canonical}"${dnt}${note}`;
	});
	return `Terminology to use consistently (do not paraphrase these):\n${lines.join('\n')}`;
}

/** Emit machine-checkable locks: the reply in `lang` must contain these substrings. */
export function buildGlossaryLocks(terms: GlossaryTerm[], lang: Lang): GlossaryLock[] {
	return terms.map((t) => ({
		termId: t.id,
		// For do-not-translate terms, the anchor is the bare proper noun (en form is the base).
		mustContain: t.doNotTranslate ? baseTerm(t) : t.canonical[lang],
		lang
	}));
}

/** The bare proper noun to look for in a reply (strip parenthetical glosses). */
function baseTerm(t: GlossaryTerm): string {
	// e.g. "Nyepi (Day of Silence)" -> "Nyepi"; "清真 (halal)" -> use the latin anchor "halal".
	if (t.id === 'halal') return 'halal';
	if (t.id === 'canang-sari') return 'canang sari';
	if (t.id === 'honorific-bapak-ibu') return 'Bapak';
	return t.canonical.en.replace(/\s*\(.*?\)\s*/g, '').trim();
}
