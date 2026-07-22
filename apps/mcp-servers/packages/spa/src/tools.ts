import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { spaRepo } from './data/spa-repo.js';
import { guardBooking } from './constraints.js';
import {
	ListServicesSchema,
	GetServiceSchema,
	CheckAvailabilitySchema,
	CreateBookingSchema,
	CancelBookingSchema
} from './schemas/spa.schema.js';

// MCP tool results must be { content: [{ type: 'text', text: <string> }] }.
function textResult(obj: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

export function registerTools(server: McpServer) {
	server.tool(
		'list_spa_services',
		'List or search spa services/treatments. Returns name (en/zh/id), category, duration, price (IDR) and contraindications. Use this for recommendations and descriptions.',
		ListServicesSchema.shape,
		async (args) => {
			const { keyword, category } = ListServicesSchema.parse(args);
			const services = await spaRepo.listServices({ keyword, category });
			return textResult({ services });
		}
	);

	server.tool(
		'get_spa_service',
		'Get the full detail of a single spa service by its id (duration, price, description, contraindications).',
		GetServiceSchema.shape,
		async (args) => {
			const { service_id } = GetServiceSchema.parse(args);
			const service = await spaRepo.getService(service_id);
			return textResult(service ? { service } : { error: 'service_not_found', service_id });
		}
	);

	server.tool(
		'check_spa_availability',
		'Check available time slots for a spa service on a given date. Both service_id and date are needed to compute real slots.',
		CheckAvailabilitySchema.shape,
		async (args) => {
			const { service_id, date } = CheckAvailabilitySchema.parse(args);
			if (!service_id || !date) {
				return textResult({ slots: [], note: 'service_id and date are required to compute availability' });
			}
			const slots = await spaRepo.getAvailability(service_id, date);
			return textResult({ serviceId: service_id, date, slots });
		}
	);

	server.tool(
		'create_spa_booking',
		'Create a spa booking for a guest. Validates the slot first and REJECTS if the chosen time is unavailable (returns the free slots instead).',
		CreateBookingSchema.shape,
		async (args) => {
			const p = CreateBookingSchema.parse(args);

			// FINAL server-side safety gate — never write a booking that violates a
			// hard rule, regardless of what the client did. Defense in depth.
			const service = await spaRepo.getService(p.service_id);
			const guard = guardBooking({
				date: p.date,
				time: p.time,
				contraindications: service?.contraindications ?? [],
				maxPartySize: service?.maxPartySize,
				partySize: p.party_size,
				pregnant: p.pregnant,
				guestConditions: p.guest_conditions
			});
			if (!guard.ok) {
				return textResult({ ok: false, rejected: true, code: guard.code, reason: guard.reason });
			}

			const result = await spaRepo.createBooking({
				serviceId: p.service_id,
				roomId: p.room_id,
				date: p.date,
				time: p.time,
				therapistGenderPref: p.therapist_gender_preference,
				notes: p.notes
			});
			return textResult(result);
		}
	);

	server.tool(
		'cancel_spa_booking',
		'Cancel an existing spa booking by confirmation code.',
		CancelBookingSchema.shape,
		async (args) => {
			const { booking_id } = CancelBookingSchema.parse(args);
			const r = await spaRepo.cancelBooking(booking_id);
			return textResult({ success: r.ok, bookingId: booking_id });
		}
	);
}
