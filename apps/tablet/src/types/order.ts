export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface OrderItem {
	itemId: string;
	name: string;
	price: number;
	quantity: number;
	specialInstructions?: string;
}

export interface Order {
	id: string;
	roomId: string;
	staffId: string;
	items: OrderItem[];
	subtotal: number;
	total: number;
	status: OrderStatus;
	createdAt: string;
	updatedAt: string;
	notes?: string;
}

export interface CreateOrderRequest {
	roomId: string;
	items: OrderItem[];
	notes?: string;
}

export interface CreateOrderResponse {
	success: boolean;
	orderId: string;
	estimatedMinutes?: number;
}
