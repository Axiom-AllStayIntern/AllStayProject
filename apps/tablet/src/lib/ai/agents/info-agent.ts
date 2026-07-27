// Info agent — answers guest questions.
//
// Two tiers:
//   1. Operational facts (wifi, pool, checkout…) → instant static FAQ, no LLM.
//   2. Everything else (etiquette, culture, "how much do I tip", temple dress,
//      greetings, offerings…) → a culturally-GROUNDED LLM answer: the cultural
//      register + retrieved KB facts are injected so the reply is accurate and
//      culturally appropriate, instead of the old "I'm not sure, call the desk"
//      deflection. The grounding respects CULTURAL_LAYERS (off→plain answer,
//      all→register+KB), so the eval measures the layer's real contribution.

import { anthropicProvider } from '../providers/anthropic-provider.js';
import { buildCurationContext } from '../curation/index.js';

export interface InfoIntent {
	query: string;
	language: 'en' | 'zh' | 'id';
}

export interface AgentResult {
	success: boolean;
	reply: string;
	data?: unknown;
}

// Operational facts that are exact + property-specific — answered instantly,
// no LLM (fast, deterministic, cheap).
const FAQ: Record<string, string> = {
	wifi: 'The WiFi network is "AllStay_Guest". No password required. Enjoy complimentary high-speed internet throughout the property.',
	pool: 'The pool is open daily from 7:00 AM to 10:00 PM. Towels are available poolside.',
	checkout: 'Standard checkout time is 12:00 PM. Late checkout until 2:00 PM is available upon request.',
	breakfast: 'Breakfast is served at The Garden Restaurant from 7:00 AM to 10:30 AM.',
	currency: 'The local currency is Indonesian Rupiah (IDR). ATMs are available at the lobby.'
};

const LANG_NAME: Record<string, string> = { en: 'English', zh: 'Chinese (中文)', id: 'Bahasa Indonesia' };

export async function handleInfoIntent(intent: InfoIntent): Promise<AgentResult> {
	const queryLower = intent.query.toLowerCase();

	// Tier 1: operational FAQ fast-path.
	for (const [keyword, answer] of Object.entries(FAQ)) {
		if (queryLower.includes(keyword)) {
			return { success: true, reply: answer };
		}
	}

	// Tier 2: culturally-grounded answer. Curation injects register + KB facts
	// (or nothing, under CULTURAL_LAYERS=off) so the eval can attribute the gain.
	const curation = buildCurationContext({ query: intent.query, lang: intent.language, intent: 'info' });
	const system =
		`You are AllStay, a warm and knowledgeable concierge at a luxury Bali resort. ` +
		`Answer the guest's question helpfully and accurately in ${LANG_NAME[intent.language] ?? 'the guest\'s language'}. ` +
		`Be culturally appropriate for Bali/Indonesia (respectful tone, honorifics where natural, ` +
		`halal/religious sensitivity, local etiquette). Keep it concise — 1 to 3 sentences. ` +
		`If you truly don't know a property-specific detail, briefly suggest the front desk (dial 0).` +
		(curation.systemFragment ? `\n\n${curation.systemFragment}` : '');

	try {
		const res = await anthropicProvider.generate({
			system,
			messages: [{ role: 'user', content: intent.query }],
			temperature: 0.4
		});
		const reply = res.text.trim();
		if (reply) return { success: true, reply };
	} catch {
		/* fall through to safe deflection */
	}

	return {
		success: true,
		reply:
			intent.language === 'zh'
				? '这个我不太确定，请拨打房间电话“0”联系前台，我们的团队很乐意为您解答。'
				: intent.language === 'id'
					? 'Untuk hal itu saya kurang yakin — silakan tekan "0" di telepon kamar untuk menghubungi resepsionis, tim kami dengan senang hati membantu.'
					: 'I\'m not sure about that. Please contact the front desk by dialing "0" on your room phone, and our team will be happy to help.'
	};
}
