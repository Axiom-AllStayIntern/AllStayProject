// Layer 2 of the cultural optimization: a small "Saka" cultural knowledge base
// for Bali / Indonesia, with keyword retrieval. Relevant facts are injected into
// the agent prompt so answers are grounded in real local context instead of the
// model's generic priors.
//
// This is intentionally a compact, hand-curated KB. It can later be replaced by
// a vector store / RAG index without changing callers (keep retrieveCulturalFacts).

export interface CulturalFact {
	id: string;
	tags: string[];
	text: string;
}

export const CULTURAL_KB: CulturalFact[] = [
	{
		id: 'saka-calendar',
		tags: ['saka', 'calendar', 'date', 'new year', '历法', '日历'],
		text: 'Bali uses the Saka lunar calendar. Saka New Year is marked by Nyepi (the Day of Silence), usually in March. Dates of ceremonies shift year to year.'
	},
	{
		id: 'nyepi',
		tags: ['nyepi', 'silence', 'holiday', 'closed', 'new year', 'saka', '静居日', '安宁日'],
		text: 'On Nyepi (Day of Silence) the whole island stops: no travel, no outdoor activity, lights kept low, airport closed. Resort services, spa and tours pause. Never schedule bookings on Nyepi; suggest the day before or after.'
	},
	{
		id: 'galungan-kuningan',
		tags: ['galungan', 'kuningan', 'festival', 'ceremony', 'penjor', 'holiday'],
		text: 'Galungan and Kuningan are major Balinese Hindu celebrations (tall bamboo "penjor" poles line the streets). Some local staff may request leave; temples and roads can be busy.'
	},
	{
		id: 'canang-sari',
		tags: ['offering', 'canang', 'flowers', 'etiquette', 'temple'],
		text: 'Canang sari are small daily flower offerings placed on the ground and shrines. Do not step on or over them; step around.'
	},
	{
		id: 'honorifics',
		tags: ['honorific', 'address', 'name', 'greeting', 'bapak', 'ibu', 'politeness', '称呼'],
		text: 'Address guests politely: Bapak/Pak (men), Ibu/Bu (women); Mas/Mbak for younger or casual contexts. Using an honorific with the name is warm and respectful.'
	},
	{
		id: 'halal-food',
		tags: ['halal', 'muslim', 'pork', 'alcohol', 'food', 'ramadan', 'fasting', '清真'],
		text: 'Many Indonesian guests are Muslim: offer halal options, avoid assuming pork or alcohol, and be mindful of fasting hours during Ramadan. Bali also has abundant vegetarian options.'
	},
	{
		id: 'greetings',
		tags: ['greeting', 'hello', 'selamat', 'om swastiastu', '问候'],
		text: 'Common greetings: "Selamat pagi/siang/sore/malam" (good morning/day/evening/night). In Balinese Hindu context, "Om Swastiastu" is a warm greeting.'
	},
	{
		id: 'temple-etiquette',
		tags: ['temple', 'pura', 'sarong', 'sash', 'dress', 'etiquette', 'visit'],
		text: 'To enter temples, wear a sarong and sash (usually provided). Dress modestly; by tradition, menstruating women do not enter temple grounds.'
	},
	{
		id: 'tipping',
		tags: ['tip', 'tipping', 'service charge', 'gratuity', 'payment'],
		text: 'A service charge (often 10%+) is usually included on bills. Tipping is appreciated but not obligatory; small cash tips for good service are common.'
	},
	{
		id: 'spa-ramadan',
		tags: ['spa', 'ramadan', 'fasting', 'massage', 'timing'],
		text: 'During Ramadan, some Muslim guests fast in daylight and may prefer spa or dining after sunset (iftar). Offer later time slots sensitively.'
	}
];

/** Retrieve the most relevant cultural facts for a query by keyword/tag overlap. */
export function retrieveCulturalFacts(query: string, max = 3): CulturalFact[] {
	const q = (query ?? '').toLowerCase();
	if (!q.trim()) return [];

	const scored = CULTURAL_KB.map((fact) => {
		let score = 0;
		for (const tag of fact.tags) {
			const t = tag.toLowerCase();
			if (q.includes(t)) score += t.length >= 4 ? 3 : 2; // longer tags are more specific
		}
		// light overlap on words in the fact text
		for (const w of fact.text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5)) {
			if (q.includes(w)) score += 1;
		}
		return { fact, score };
	}).filter((s) => s.score > 0);

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, max).map((s) => s.fact);
}

/** Render retrieved facts as a prompt fragment (empty string if none). */
export function renderCulturalFacts(facts: CulturalFact[]): string {
	if (facts.length === 0) return '';
	return `Relevant local/cultural context (use only if pertinent):\n${facts.map((f) => `- ${f.text}`).join('\n')}`;
}
