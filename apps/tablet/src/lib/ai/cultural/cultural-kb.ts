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
	/** Bahasa Indonesia rendering — used when serving Indonesian guests/staff. */
	textId?: string;
	/** Optional few-shot phrasings showing HOW a concierge would weave this in. */
	fewshot?: string[];
	/** Provenance so the KB is auditable (not the model's generic priors). */
	source?: string;
	confidence?: 'high' | 'medium';
	domain?: 'faith' | 'calendar' | 'etiquette' | 'dining' | 'general';
}

export const CULTURAL_KB: CulturalFact[] = [
	{
		id: 'saka-calendar',
		tags: ['saka', 'calendar', 'date', 'new year', '历法', '日历'],
		text: 'Bali uses the Saka lunar calendar. Saka New Year is marked by Nyepi (the Day of Silence), usually in March. Dates of ceremonies shift year to year.',
		textId: 'Bali memakai kalender Saka. Tahun Baru Saka ditandai dengan Nyepi (Hari Raya Nyepi), biasanya pada bulan Maret. Tanggal upacara berubah tiap tahun.',
		domain: 'calendar',
		confidence: 'high',
		source: 'Bali Hindu Saka calendar (public cultural knowledge)'
	},
	{
		id: 'nyepi',
		tags: ['nyepi', 'silence', 'holiday', 'closed', 'new year', 'saka', '静居日', '安宁日'],
		text: 'On Nyepi (Day of Silence) the whole island stops: no travel, no outdoor activity, lights kept low, airport closed. Resort services, spa and tours pause. Never schedule bookings on Nyepi; suggest the day before or after.',
		textId: 'Pada hari Nyepi seluruh pulau berhenti: tidak ada perjalanan, tidak ada aktivitas di luar, lampu diredupkan, bandara ditutup. Layanan resort, spa, dan tur berhenti. Jangan pernah menjadwalkan pemesanan saat Nyepi; sarankan sehari sebelum atau sesudahnya.',
		fewshot: ['Mohon maaf, Bapak/Ibu — pada hari Nyepi seluruh layanan resort berhenti. Boleh saya carikan jadwal sehari sebelum atau sesudahnya?'],
		domain: 'calendar',
		confidence: 'high',
		source: 'Bali Nyepi observance'
	},
	{
		id: 'galungan-kuningan',
		tags: ['galungan', 'kuningan', 'festival', 'ceremony', 'penjor', 'holiday'],
		text: 'Galungan and Kuningan are major Balinese Hindu celebrations (tall bamboo "penjor" poles line the streets). Some local staff may request leave; temples and roads can be busy.',
		textId: 'Galungan dan Kuningan adalah perayaan besar Hindu Bali (penjor bambu tinggi berjajar di jalan). Sebagian staf lokal mungkin cuti; pura dan jalan bisa ramai.',
		domain: 'calendar',
		confidence: 'high'
	},
	{
		id: 'canang-sari',
		tags: ['offering', 'canang', 'flowers', 'etiquette', 'temple'],
		text: 'Canang sari are small daily flower offerings placed on the ground and shrines. Do not step on or over them; step around.',
		textId: 'Canang sari adalah persembahan bunga harian kecil yang diletakkan di tanah dan pelinggih. Jangan menginjak atau melangkahinya; berjalanlah memutar.',
		domain: 'etiquette',
		confidence: 'high'
	},
	{
		id: 'honorifics',
		tags: ['honorific', 'address', 'name', 'greeting', 'bapak', 'ibu', 'politeness', '称呼'],
		text: 'Address guests politely: Bapak/Pak (men), Ibu/Bu (women); Mas/Mbak for younger or casual contexts. Using an honorific with the name is warm and respectful.',
		textId: 'Sapa tamu dengan sopan: Bapak/Pak (pria), Ibu/Bu (wanita); Mas/Mbak untuk konteks lebih santai. Menyebut nama dengan sapaan terasa hangat dan hormat.',
		domain: 'etiquette',
		confidence: 'high'
	},
	{
		id: 'halal-food',
		tags: ['halal', 'muslim', 'pork', 'alcohol', 'food', 'ramadan', 'fasting', '清真'],
		text: 'Many Indonesian guests are Muslim: offer halal options, avoid assuming pork or alcohol, and be mindful of fasting hours during Ramadan. Bali also has abundant vegetarian options.',
		textId: 'Banyak tamu Indonesia beragama Islam: tawarkan pilihan halal, jangan berasumsi ada babi atau alkohol, dan perhatikan jam puasa saat Ramadan. Bali juga punya banyak pilihan vegetarian.',
		fewshot: ['Tentu, Bapak/Ibu — kami punya pilihan halal untuk keluarga; saya tandai agar tanpa babi maupun alkohol.'],
		domain: 'dining',
		confidence: 'high'
	},
	{
		id: 'greetings',
		tags: ['greeting', 'hello', 'selamat', 'om swastiastu', '问候'],
		text: 'Common greetings: "Selamat pagi/siang/sore/malam" (good morning/day/evening/night). In Balinese Hindu context, "Om Swastiastu" is a warm greeting.',
		textId: 'Sapaan umum: "Selamat pagi/siang/sore/malam". Dalam konteks Hindu Bali, "Om Swastiastu" adalah sapaan yang hangat.',
		domain: 'etiquette',
		confidence: 'high'
	},
	{
		id: 'temple-etiquette',
		tags: ['temple', 'pura', 'sarong', 'sash', 'dress', 'etiquette', 'visit'],
		text: 'To enter temples, wear a sarong and sash (usually provided). Dress modestly; by tradition, menstruating women do not enter temple grounds.',
		textId: 'Untuk masuk pura, kenakan kain sarung dan selendang (biasanya disediakan). Berpakaian sopan; menurut tradisi, wanita yang sedang haid tidak memasuki area pura.',
		domain: 'etiquette',
		confidence: 'high'
	},
	{
		id: 'tipping',
		tags: ['tip', 'tipping', 'service charge', 'gratuity', 'payment'],
		text: 'A service charge (often 10%+) is usually included on bills. Tipping is appreciated but not obligatory; small cash tips for good service are common.',
		textId: 'Biaya layanan (sering 10%+) biasanya sudah termasuk dalam tagihan. Tip dihargai tetapi tidak wajib; tip tunai kecil untuk layanan baik umum diberikan.',
		domain: 'general',
		confidence: 'medium'
	},
	{
		id: 'spa-ramadan',
		tags: ['spa', 'ramadan', 'fasting', 'massage', 'timing'],
		text: 'During Ramadan, some Muslim guests fast in daylight and may prefer spa or dining after sunset (iftar). Offer later time slots sensitively.',
		textId: 'Selama Ramadan, sebagian tamu Muslim berpuasa di siang hari dan mungkin lebih suka spa atau makan setelah magrib (buka puasa). Tawarkan jadwal sore/malam dengan peka.',
		fewshot: ['Tentu, Bapak/Ibu — selama Ramadan banyak tamu memilih jadwal setelah buka puasa. Boleh saya carikan slot sore atau malam?'],
		domain: 'faith',
		confidence: 'high'
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

/** Render retrieved facts as a prompt fragment (empty string if none).
 *  Pass lang='id' to prefer the Bahasa Indonesia corpus where available. */
export function renderCulturalFacts(facts: CulturalFact[], lang: 'en' | 'zh' | 'id' = 'en'): string {
	if (facts.length === 0) return '';
	const pick = (f: CulturalFact) => (lang === 'id' && f.textId ? f.textId : f.text);
	return `Relevant local/cultural context (use only if pertinent):\n${facts.map((f) => `- ${pick(f)}`).join('\n')}`;
}
