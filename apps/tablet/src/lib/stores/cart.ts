import { writable, derived } from 'svelte/store';
import type { Cart, CartItem } from '$types/cart.js';

function createCartStore() {
	const { subscribe, set, update } = writable<Cart>({
		roomId: '',
		items: [],
		subtotal: 0,
		total: 0,
		itemCount: 0
	});

	function recalculate(items: CartItem[], roomId: string): Cart {
		const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
		const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
		return { roomId, items, subtotal, total: subtotal, itemCount };
	}

	return {
		subscribe,
		addItem(roomId: string, item: Omit<CartItem, 'id'>) {
			update((cart) => {
				// Merge if same itemId + same specialInstructions
				const existing = cart.items.find(
					(i) =>
						i.itemId === item.itemId &&
						i.specialInstructions === item.specialInstructions
				);
				let items: CartItem[];
				if (existing) {
					items = cart.items.map((i) =>
						i === existing ? { ...i, quantity: i.quantity + item.quantity } : i
					);
				} else {
					items = [...cart.items, { ...item, id: crypto.randomUUID() }];
				}
				return recalculate(items, roomId);
			});
		},
		updateQuantity(itemId: string, quantity: number) {
			update((cart) => {
				const items =
					quantity <= 0
						? cart.items.filter((i) => i.id !== itemId)
						: cart.items.map((i) => (i.id === itemId ? { ...i, quantity } : i));
				return recalculate(items, cart.roomId);
			});
		},
		removeItem(itemId: string) {
			update((cart) => {
				const items = cart.items.filter((i) => i.id !== itemId);
				return recalculate(items, cart.roomId);
			});
		},
		clear() {
			set({ roomId: '', items: [], subtotal: 0, total: 0, itemCount: 0 });
		}
	};
}

export const cart = createCartStore();
export const cartItemCount = derived(cart, ($cart) => $cart.itemCount);
