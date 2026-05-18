export type CartItemSource = 'dining' | 'spa' | 'restaurant' | 'transport';

export interface CartItem {
	id: string; // uuid
	source: CartItemSource;
	itemId: string;
	name: string;
	price: number; // IDR
	quantity: number;
	specialInstructions?: string;
	// For bookings
	bookingDate?: string; // ISO 8601
	bookingTime?: string; // HH:MM
}

export interface Cart {
	roomId: string;
	items: CartItem[];
	subtotal: number;
	total: number;
	itemCount: number;
}
