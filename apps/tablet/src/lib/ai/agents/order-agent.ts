import { callMcpTool } from '../tools/mcp-client.js';

export interface OrderIntent {
	dish?: string;
	quantity?: number;
	specialInstructions?: string;
	roomId: string;
}

export interface AgentResult {
	success: boolean;
	reply: string;
	data?: unknown;
}

// Mirrors the static MENU in dining/+page.svelte — used when MCP is unreachable
const STATIC_MENU = [
	{ id: 'nasi',  name: { en: 'Nasi Goreng',           zh: '印尼炒饭' },     price: 85000 },
	{ id: 'mie',   name: { en: 'Mie Goreng',            zh: '印尼炒面' },     price: 75000 },
	{ id: 'club',  name: { en: 'Club Sandwich',         zh: '俱乐部三明治' }, price: 95000 },
	{ id: 'pkx',   name: { en: 'Pancake Stack',         zh: '松饼塔' },      price: 65000 },
	{ id: 'fruit', name: { en: 'Tropical Fruit Platter', zh: '热带水果拼盘' }, price: 55000 },
	{ id: 'coco',  name: { en: 'Fresh Coconut Water',   zh: '鲜椰青' },      price: 35000 },
];

function findInStaticMenu(keyword: string) {
	const kw = keyword.toLowerCase();
	return STATIC_MENU.find(
		(item) =>
			item.name.en.toLowerCase().includes(kw) ||
			item.name.zh.includes(keyword) ||
			item.id.toLowerCase().includes(kw)
	);
}

function fmtPrice(n: number) {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency', currency: 'IDR', minimumFractionDigits: 0
	}).format(n);
}

export async function handleOrderIntent(intent: OrderIntent): Promise<AgentResult> {
	if (!intent.dish) {
		return { success: false, reply: 'I could not identify the dish. Could you clarify?' };
	}

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
			const label = notes ? ` (${notes})` : '';
			return {
				success: true,
				reply: `Added ${matched.name.en}${label} to your cart — ${fmtPrice(matched.price)}. Would you like anything else?`,
				data: cartResult.data
			};
		}
	}

	// ── 2. MCP unreachable — fall back to static menu ─────────────────────────
	const matched = findInStaticMenu(intent.dish);
	if (!matched) {
		return {
			success: false,
			reply: `Sorry, I couldn't find "${intent.dish}" on the menu. You can browse and tap any item to add it.`
		};
	}

	const label = notes ? ` (${notes})` : '';
	const cartItem = {
		item_id: matched.id,
		name: matched.name.en,
		price: matched.price,
		quantity: qty,
		special_instructions: notes
	};

	return {
		success: true,
		reply: `Added ${matched.name.en}${label} ×${qty} to your cart — ${fmtPrice(matched.price * qty)}. Would you like anything else?`,
		data: cartItem
	};
}
