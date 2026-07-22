import { z } from 'zod';

export const ListServicesSchema = z.object({
	keyword: z.string().optional(),
	category: z.enum(['massage', 'facial', 'body', 'package']).optional()
});

export const GetServiceSchema = z.object({
	service_id: z.string().min(1)
});

export const CheckAvailabilitySchema = z.object({
	service_id: z.string().optional(),
	date: z.string().optional()
});

export const CreateBookingSchema = z.object({
	service_id: z.string().min(1),
	room_id: z.string().min(1),
	date: z.string().min(1),
	time: z.string().min(1),
	therapist_gender_preference: z.enum(['male', 'female', 'no_preference']).optional(),
	notes: z.string().max(500).optional(),
	// Guest profile passed for the server-side constraint gate (defense in depth).
	pregnant: z.boolean().optional(),
	guest_conditions: z.array(z.string()).optional(),
	party_size: z.number().int().positive().optional()
});

export const CancelBookingSchema = z.object({
	booking_id: z.string().min(1)
});
