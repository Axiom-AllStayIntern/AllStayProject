import { callMcpTool } from '../tools/mcp-client.js';

export interface OrderIntent {
	dish?: string;
	rawMessage?: string;    // original user utterance — used as fallback search term
	quantity?: number;
	specialInstructions?: string;
	roomId: string;
	language?: 'en' | 'zh';
}

export interface AgentResult {
	success: boolean;
	/** Short factual confirmation line — orchestrator prepends Claude's contextual reply to this */
	confirmLine?: string;
	/** Standalone reply used only on failure (no Claude reply to prepend) */
	reply?: string;
	data?: unknown;
}

// Mirrors the static MENU in dining/+page.svelte — used when MCP is unreachable
const STATIC_MENU = [
	{ id: 'nasi',  name: { en: 'Nasi Goreng',            zh: '印尼炒饭' },
	  aliases: ['fried rice', 'nasi', '炒饭', '炒米饭', 'indonesian rice'],                  price: 85000 },
	{ id: 'mie',   name: { en: 'Mie Goreng',             zh: '印尼炒面' },
	  aliases: ['fried noodle', 'mie', 'mee', '炒面', '炒麵', '面条', 'noodle'],            price: 75000 },
	{ id: 'club',  name: { en: 'Club Sandwich',          zh: '俱乐部三明治' },
	  aliases: ['sandwich', 'club', '三明治', '俱乐部', '俱樂部'],                           price: 95000 },
	{ id: 'pkx',   name: { en: 'Pancake Stack',          zh: '松饼塔' },
	  aliases: ['pancake', '松饼', '煎饼', '薄饼', 'waffle'],                                price: 65000 },
	{ id: 'fruit', name: { en: 'Tropical Fruit Platter', zh: '热带水果拼盘' },
	  aliases: ['fruit', 'platter', '水果', '拼盘', '热带水果', 'tropical'],                price: 55000 },
	{ id: 'coco',  name: { en: 'Fresh Coconut Water',    zh: '鲜椰青' },
	  aliases: ['coconut', 'coconut water', '椰子', '椰青', '椰子水', '鲜椰'],              price: 35000 },
];

type MenuItem = typeof STATIC_MENU[number];

function findInStaticMenu(keyword: string): MenuItem | undefined {
	if (!keyword?.trim()) return undefined;
	const kw = keyword.toLowerCase().trim();

	// Collect all searchable strings for each item, then score by match quality
	const score = (item: MenuItem): number => {
		const targets = [
			item.name.en.toLowerCase(),
			item.name.zh,
			item.id,
			...item.aliases.map(a => a.toLowerCase())
		];
		// Exact match → highest score
		if (targets.some(t => t === kw || t === keyword)) return 3;
		// One contains the other → high score
		if (targets.some(t => t.includes(kw) || kw.includes(t))) return 2;
		// Partial Chinese character overlap
		if ([...keyword].some(ch => /[一-鿿]/.test(ch) && item.name.zh.includes(ch))) return 1;
		return 0;
	};

	return STATIC_MENU.map(item => ({ item, s: score(item) }))
		.filter(({ s }) => s > 0)
		.sort((a, b) => b.s - a.s)[0]?.item;
}

function fmtPrice(n: number) {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency', currency: 'IDR', minimumFractionDigits: 0
	}).format(n);
}

// Short factual lines — Claude's contextual reply is prepended by the orchestrator
const T = {
	en: {
		confirm:  (name: string, qty: number, price: string, notes: string) =>
			`✓ ${name}${notes ? ` (${notes})` : ''} ×${qty} added to cart — ${price}.`,
		notFound: (dish: string) =>
			`Sorry, I couldn't find "${dish}" on the menu. Feel free to browse and tap any item to add it.`,
		failed:   () => 'Failed to add item to cart. Please try again.'
	},
	zh: {
		confirm:  (name: string, qty: number, price: string, notes: string) =>
			`✓ ${name}${notes ? `（${notes}）` : ''} ×${qty} 已加入购物车 — ${price}。`,
		notFound: (dish: string) =>
			`抱歉，菜单上没有找到"${dish}"，您可以浏览菜单点击添加。`,
		failed:   () => '加入购物车失败，请重试。'
	}
} as const;

export async function handleOrderIntent(intent: OrderIntent): Promise<AgentResult> {
	if (!intent.dish) {
		return { success: false, reply: 'I could not identify the dish. Could you clarify?' };
	}

	const lang = intent.language ?? 'en';
	const t = T[lang];
	const qty = intent.quantity ?? 1;
	const notes = intent.specialInstructions ?? '';

	// ── 1. Try MCP server first ───────────────────────────────────────────────
	const searchResult = await callMcpTool({
		server: 'dining',
		tool: 'search_menu_items',
		params: { keyword: intent.dish }
	});

	if (searchResult.success && searchResult.data) {
		const items = searchResult.data as Array<{ id: string; name: { zh: string; en: string }; price: number }>;
		const matched = items[0];
		if (matched) {
			const cartResult = await callMcpTool({
				server: 'dining',
				tool: 'add_to_cart',
				params: { room_id: intent.roomId, item_id: matched.id, quantity: qty, special_instructions: notes }
			});
			const itemName = lang === 'zh' ? matched.name.zh : matched.name.en;
			return {
				success: true,
				confirmLine: t.confirm(itemName, qty, fmtPrice(matched.price * qty), notes),
				data: cartResult.data
			};
		}
	}

	// ── 2. MCP unreachable — fall back to static menu ─────────────────────────
	const matched = findInStaticMenu(intent.dish) ?? (intent.rawMessage ? findInStaticMenu(intent.rawMessage) : undefined);
	if (!matched) {
		return { success: false, reply: t.notFound(intent.dish) };
	}

	const itemName = lang === 'zh' ? matched.name.zh : matched.name.en;
	const cartItem = {
		item_id: matched.id,
		name: itemName,
		price: matched.price,
		quantity: qty,
		special_instructions: notes
	};

	return {
		success: true,
		confirmLine: t.confirm(itemName, qty, fmtPrice(matched.price * qty), notes),
		data: cartItem
	};
}
