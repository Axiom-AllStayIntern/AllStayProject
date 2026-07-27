import Anthropic from '@anthropic-ai/sdk';
import { getAnthropic, anthropicModel } from '../providers/anthropic-provider.js';
import { callMcpTool } from '../tools/mcp-client.js';
import { buildCurationContext } from '../curation/index.js';

/**
 * SPA concierge agent.
 *
 * This is the "skill" that teaches the model HOW to use the spa MCP tools to
 * fetch structured spa data and reason out a grounded recommendation. It runs a
 * small agentic tool-use loop over READ-ONLY tools (listing / details /
 * availability). It never books — booking stays a separate, confirmed step.
 */

// ── The skill: instructions for tool use + recommendation ───────────────────

const SPA_SYSTEM = `You are AllStay's spa concierge for a luxury resort in Bali.

Ground EVERY answer in real data from the tools — never invent treatments, prices, durations, or availability.

How to use the tools:
- To recommend or answer anything about treatments, FIRST call "list_spa_services" (optionally with keyword or category) to get the live catalogue.
- Call "get_spa_service" for full details/contraindications of a specific treatment when needed.
- Only if the guest gives BOTH a specific treatment and a date, you may call "check_spa_availability" to state open time slots.

How to recommend:
- Match the guest's stated preferences, party size, budget and time.
- Respect contraindications: never recommend a treatment whose contraindications match the guest's situation (e.g. pregnancy, high blood pressure, an allergy). If unsure, mention the caution.
- Recommend at most 1–2 services, each with a one-line reason. Include duration and price in IDR.

Style:
- Keep replies short (2–3 sentences), warm and specific.
- Do NOT book anything and do NOT ask for a credit card — booking is confirmed on a separate step. You may suggest a next step like offering to check availability.`;

function langNote(language: 'en' | 'zh' | 'id'): string {
	if (language === 'zh') return 'Reply in Simplified Chinese.';
	if (language === 'id') return 'Reply in Bahasa Indonesia (warm, polite; use Bapak/Ibu where natural).';
	return 'Reply in English.';
}

// ── Tool schemas exposed to the model (read-only) ───────────────────────────

const SPA_TOOLS: Anthropic.Tool[] = [
	{
		name: 'list_spa_services',
		description: 'List or search spa treatments. Returns id, names, category, durationMin, priceIdr and contraindications.',
		input_schema: {
			type: 'object',
			properties: {
				keyword: { type: 'string', description: 'Optional keyword to filter by name.' },
				category: { type: 'string', enum: ['massage', 'facial', 'body', 'package'] }
			}
		}
	},
	{
		name: 'get_spa_service',
		description: 'Get full detail of a single spa treatment by its id.',
		input_schema: {
			type: 'object',
			properties: { service_id: { type: 'string' } },
			required: ['service_id']
		}
	},
	{
		name: 'check_spa_availability',
		description: 'Check open time slots for a treatment on a date. Needs both service_id and date.',
		input_schema: {
			type: 'object',
			properties: {
				service_id: { type: 'string' },
				date: { type: 'string', description: 'ISO date, e.g. 2026-07-21' }
			},
			required: ['service_id', 'date']
		}
	}
];

const SPA_READ_TOOLS = new Set(['list_spa_services', 'get_spa_service', 'check_spa_availability']);

export interface SpaConciergeInput {
	message: string;
	language: 'en' | 'zh' | 'id';
	history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface SpaConciergeResult {
	reply: string;
	toolsUsed: string[];
	/** service_ids the model inspected/recommended, in order seen. */
	recommendedServiceIds: string[];
}

export async function runSpaConcierge(input: SpaConciergeInput): Promise<SpaConciergeResult> {
	const client = getAnthropic();

	const messages: Anthropic.MessageParam[] = [
		...(input.history ?? []).map((m) => ({ role: m.role, content: m.content })),
		{ role: 'user', content: input.message }
	];

	const toolsUsed: string[] = [];
	const recommendedServiceIds: string[] = [];
	const MAX_HOPS = 4;

	// Curated localization context: register (L1) + retrieved Saka/Bali facts (L2)
	// + canonical glossary + few-shot phrasings, assembled in one call.
	const curation = buildCurationContext({ query: input.message, lang: input.language, intent: 'spa_info' });
	const system = [SPA_SYSTEM, langNote(input.language), curation.systemFragment]
		.filter(Boolean)
		.join('\n\n');

	for (let hop = 0; hop < MAX_HOPS; hop++) {
		const res = await client.messages.create({
			model: anthropicModel(),
			max_tokens: 1024,
			system,
			tools: SPA_TOOLS,
			messages
		});

		if (res.stop_reason === 'tool_use') {
			messages.push({ role: 'assistant', content: res.content });

			const toolResults: Anthropic.ToolResultBlockParam[] = [];
			for (const block of res.content) {
				if (block.type !== 'tool_use') continue;
				toolsUsed.push(block.name);

				const args = (block.input ?? {}) as Record<string, unknown>;
				if (typeof args.service_id === 'string') recommendedServiceIds.push(args.service_id);

				let payload: unknown;
				if (SPA_READ_TOOLS.has(block.name)) {
					const r = await callMcpTool({ server: 'spa', tool: block.name, params: args });
					payload = r.success ? r.data : { error: r.error };
				} else {
					payload = { error: `tool not permitted: ${block.name}` };
				}

				toolResults.push({
					type: 'tool_result',
					tool_use_id: block.id,
					content: JSON.stringify(payload)
				});
			}

			messages.push({ role: 'user', content: toolResults });
			continue;
		}

		// Final answer.
		const reply = res.content
			.filter((b): b is Anthropic.TextBlock => b.type === 'text')
			.map((b) => b.text)
			.join(' ')
			.trim();
		return { reply, toolsUsed, recommendedServiceIds };
	}

	return {
		reply:
			input.language === 'zh'
				? '我这边查询有点慢，请稍后再问一次，或直接告诉我想要的疗程和时间。'
				: "That took a bit long — please ask again, or just tell me the treatment and time you'd like.",
		toolsUsed,
		recommendedServiceIds
	};
}

// ── Deterministic serviceId resolver (used by the booking path) ─────────────
// Maps a free-text mention ("Balinese massage" / "巴厘按摩") to a catalogue id,
// without an LLM call. Returns null if no confident match.

interface CatalogService {
	id: string;
	nameEn: string;
	nameZh: string;
	nameId: string;
}

export async function resolveSpaServiceId(text: string): Promise<string | null> {
	if (!text?.trim()) return null;
	const r = await callMcpTool({ server: 'spa', tool: 'list_spa_services', params: {} });
	if (!r.success) return null;
	const services = (r.data as { services?: CatalogService[] })?.services ?? [];

	const hay = text.toLowerCase();
	let best: { id: string; score: number } | null = null;

	for (const s of services) {
		let score = 0;

		// Strong signals: exact id or full localized name present in the utterance.
		if (hay.includes(s.id.toLowerCase())) score += 10;
		if (hay.includes(s.nameEn.toLowerCase())) score += 8;
		if (s.nameId && hay.includes(s.nameId.toLowerCase())) score += 8;
		if (s.nameZh && text.includes(s.nameZh)) score += 8;

		// English token overlap (distinctive words, len >= 4).
		for (const t of s.nameEn.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4)) {
			if (hay.includes(t)) score += 2;
		}

		// Chinese 2-gram overlap (handles partial names like "巴厘按摩" vs "传统巴厘按摩").
		for (let i = 0; i + 2 <= s.nameZh.length; i++) {
			const gram = s.nameZh.slice(i, i + 2);
			if (/^[一-鿿]{2}$/.test(gram) && text.includes(gram)) score += 2;
		}

		if (score > 0 && (!best || score > best.score)) best = { id: s.id, score };
	}

	return best?.id ?? null;
}
