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

export async function handleOrderIntent(intent: OrderIntent): Promise<AgentResult> {
	if (!intent.dish) {
		return { success: false, reply: 'I could not identify the dish. Could you clarify?' };
	}

	// 1. Search for the dish
	const searchResult = await callMcpTool({
		server: 'dining',
		tool: 'search_menu_items',
		params: { keyword: intent.dish }
	});

	if (!searchResult.success || !searchResult.data) {
		return { success: false, reply: `Sorry, I could not find "${intent.dish}" on the menu.` };
	}

	const items = searchResult.data as Array<{ id: string; name: { zh: string; en: string }; price: number }>;
	if (items.length === 0) {
		return { success: false, reply: `"${intent.dish}" is not available right now.` };
	}

	const matched = items[0];

	// 2. Add to cart
	const cartResult = await callMcpTool({
		server: 'dining',
		tool: 'add_to_cart',
		params: {
			room_id: intent.roomId,
			item_id: matched.id,
			quantity: intent.quantity ?? 1,
			special_instructions: intent.specialInstructions ?? ''
		}
	});

	if (!cartResult.success) {
		return { success: false, reply: 'Failed to add item to cart. Please try again.' };
	}

	const name = matched.name.en;
	const price = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(matched.price);
	const notes = intent.specialInstructions ? ` (${intent.specialInstructions})` : '';

	return {
		success: true,
		reply: `Added ${name}${notes} to your cart — ${price}. Would you like to confirm the order?`,
		data: cartResult.data
	};
}
