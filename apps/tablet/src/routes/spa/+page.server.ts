import type { PageServerLoad } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';

// Single source of truth: the touch page now pulls the SAME spa catalogue the
// voice/AI pipeline uses (spa MCP `list_spa_services`), instead of its own
// hardcoded list. fixtures carry no glyph/imageUrl, so we derive a deterministic
// glyph from the service category to keep the existing card visuals.
const GLYPH_BY_CATEGORY: Record<string, string> = {
	massage: 'leaf',
	facial: 'flower',
	body: 'stone',
	package: 'hearts'
};

interface McpSpaService {
	id: string;
	nameEn: string;
	nameZh: string;
	nameId: string;
	category: string;
	durationMin: number;
	priceIdr: number;
	descEn: string;
	descZh: string;
	contraindications: string[];
	maxPartySize: number;
}

export const load: PageServerLoad = async () => {
	const result = await callMcpTool({
		server: 'spa',
		tool: 'list_spa_services',
		params: {}
	});

	if (!result.success) {
		// Degrade gracefully instead of showing stale hardcoded data — keeps the
		// single-source guarantee. The page renders a friendly empty state.
		console.warn('[spa page] list_spa_services failed:', result.error);
		return { services: [], sourceError: true };
	}

	const raw = (result.data as { services?: McpSpaService[] })?.services ?? [];
	const services = raw.map((s) => ({
		id: s.id,
		glyph: GLYPH_BY_CATEGORY[s.category] ?? 'leaf',
		name: { en: s.nameEn, zh: s.nameZh, id: s.nameId },
		// fixtures have no Indonesian description yet — fall back to English for id.
		description: { en: s.descEn, zh: s.descZh, id: s.descEn },
		duration: s.durationMin,
		price: s.priceIdr,
		isAvailable: true,
		maxPartySize: s.maxPartySize,
		contraindications: s.contraindications
	}));

	return { services, sourceError: false };
};
