import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { query } from '@allstay/shared/database.js';
import { getCart, setCart } from '@allstay/shared/redis.js';
import { printOrder } from '@allstay/shared/printer.js';
import {
	SearchMenuItemsSchema,
	AddToCartSchema,
	UpdateCartItemSchema,
	PlaceOrderSchema
} from './schemas/menu.schema.js';

export function registerTools(server: McpServer) {
	server.tool(
		'search_menu_items',
		'Search or list menu items, optionally filtered by category or keyword',
		SearchMenuItemsSchema.shape,
		async (args) => {
			const { keyword, category_id } = SearchMenuItemsSchema.parse(args);
			let sql = 'SELECT * FROM menu_items WHERE is_available = 1';
			const params: string[] = [];

			if (category_id) {
				sql += ' AND category_id = ?';
				params.push(category_id);
			}
			if (keyword) {
				sql += ' AND (name_en LIKE ? OR name_zh LIKE ?)';
				params.push(`%${keyword}%`, `%${keyword}%`);
			}

			const items = await query(sql, params);
			return { content: [{ type: 'text', text: JSON.stringify({ items }) }] };
		}
	);

	server.tool(
		'add_to_cart',
		'Add a menu item to the guest\'s cart. Merges if same item + same special instructions.',
		AddToCartSchema.shape,
		async (args) => {
			const { room_id, item_id, quantity, special_instructions } = AddToCartSchema.parse(args);
			const items = await getCart(room_id) as Array<{ item_id: string; quantity: number; special_instructions?: string }>;

			const existing = items.find(
				(i) => i.item_id === item_id && i.special_instructions === (special_instructions ?? '')
			);

			if (existing) {
				existing.quantity += quantity;
			} else {
				items.push({ item_id, quantity, special_instructions: special_instructions ?? '' });
			}

			await setCart(room_id, items);
			return { content: [{ type: 'text', text: JSON.stringify({ success: true, cart: items }) }] };
		}
	);

	server.tool(
		'update_cart_item',
		'Update quantity of an item in the cart. Set quantity to 0 to remove.',
		UpdateCartItemSchema.shape,
		async (args) => {
			const { room_id, item_id, quantity } = UpdateCartItemSchema.parse(args);
			let items = await getCart(room_id) as Array<{ item_id: string; quantity: number }>;

			if (quantity === 0) {
				items = items.filter((i) => i.item_id !== item_id);
			} else {
				const existing = items.find((i) => i.item_id === item_id);
				if (existing) existing.quantity = quantity;
			}

			await setCart(room_id, items);
			return { content: [{ type: 'text', text: JSON.stringify({ success: true, cart: items }) }] };
		}
	);

	server.tool(
		'place_order',
		'Submit the order to the kitchen and print a receipt.',
		PlaceOrderSchema.shape,
		async (args) => {
			const { staff_id, items, notes } = PlaceOrderSchema.parse(args);
			const orderId = `ORD-${Date.now()}`;

			// TODO: INSERT into cakrasoft_pms orders table
			// await query('INSERT INTO orders ...', [...]);

			await printOrder({
				orderId,
				roomId: staff_id, // will be passed separately in real impl
				items: items.map((i) => ({
					name: i.item_id, // resolve name from DB in real impl
					quantity: i.quantity,
					price: 0,
					specialInstructions: i.special_instructions
				})),
				total: 0,
				timestamp: new Date().toISOString()
			});

			return { content: [{ type: 'text', text: JSON.stringify({ success: true, orderId, estimatedMinutes: 25 }) }] };
		}
	);
}
