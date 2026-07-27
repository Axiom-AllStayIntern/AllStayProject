import { z } from 'zod';

export const SearchMenuItemsSchema = z.object({
	keyword: z.string().optional(),
	category_id: z.string().optional()
});

export const AddToCartSchema = z.object({
	room_id: z.string().min(1),
	item_id: z.string().min(1),
	quantity: z.number().int().min(1).max(99),
	special_instructions: z.string().max(500).optional()
});

export const UpdateCartItemSchema = z.object({
	room_id: z.string().min(1),
	item_id: z.string().min(1),
	quantity: z.number().int().min(0).max(99)
});

export const PlaceOrderSchema = z.object({
	staff_id: z.string().min(1),
	items: z.array(z.object({
		item_id: z.string(),
		quantity: z.number().int().min(1),
		special_instructions: z.string().optional()
	})).min(1),
	notes: z.string().optional()
});
