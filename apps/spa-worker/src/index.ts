import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import { z } from 'zod';
import { SPA_SERVICES } from '../../mcp-servers/packages/spa/src/data/fixtures.js';
import { guardBooking } from '../../mcp-servers/packages/spa/src/constraints.js';

interface Env {
	SPA_DB: D1Database;
	MCP_API_TOKEN: string;
}

interface BookingRow {
	booking_time: string;
}

const BASE_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

function textResult(value: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
}

function stableHash(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
	return hash;
}

async function unavailableTimes(env: Env, serviceId: string, date: string): Promise<Set<string>> {
	const result = await env.SPA_DB.prepare(
		`SELECT booking_time FROM spa_bookings
		 WHERE service_id = ?1 AND booking_date = ?2 AND status = 'confirmed'`
	)
		.bind(serviceId, date)
		.all<BookingRow>();
	return new Set(result.results.map((row) => row.booking_time));
}

async function availability(env: Env, serviceId: string, date: string) {
	const taken = await unavailableTimes(env, serviceId, date);
	return BASE_TIMES.map((time) => ({
		time,
		isAvailable: !taken.has(time) && stableHash(`${serviceId}${date}${time}`) % 4 !== 0
	}));
}

function createServer(env: Env) {
	const server = new McpServer({ name: 'allstay-spa-mcp', version: '1.0.0' });

	server.registerTool(
		'list_spa_services',
		{
			description: 'List or search AllStay spa treatments, including localized names, duration, price and contraindications.',
			inputSchema: {
				keyword: z.string().optional(),
				category: z.enum(['massage', 'facial', 'body', 'package']).optional()
			}
		},
		async ({ keyword, category }) => {
			let services = SPA_SERVICES;
			if (category) services = services.filter((service) => service.category === category);
			if (keyword) {
				const query = keyword.toLowerCase();
				services = services.filter(
					(service) =>
						service.nameEn.toLowerCase().includes(query) ||
						service.nameZh.includes(keyword) ||
						service.nameId.toLowerCase().includes(query)
				);
			}
			return textResult({ services });
		}
	);

	server.registerTool(
		'get_spa_service',
		{
			description: 'Get the full detail of one AllStay spa treatment.',
			inputSchema: { service_id: z.string().min(1) }
		},
		async ({ service_id }) => {
			const service = SPA_SERVICES.find((item) => item.id === service_id);
			return textResult(service ? { service } : { error: 'service_not_found', service_id });
		}
	);

	server.registerTool(
		'check_spa_availability',
		{
			description: 'Check available times for a spa treatment on a given date.',
			inputSchema: {
				service_id: z.string().optional(),
				date: z.string().optional()
			}
		},
		async ({ service_id, date }) => {
			if (!service_id || !date) {
				return textResult({ slots: [], note: 'service_id and date are required to compute availability' });
			}
			const slots = await availability(env, service_id, date);
			return textResult({ serviceId: service_id, date, slots });
		}
	);

	server.registerTool(
		'create_spa_booking',
		{
			description: 'Create a validated spa booking and reject unavailable times.',
			inputSchema: {
				service_id: z.string().min(1),
				room_id: z.string().min(1),
				date: z.string().min(1),
				time: z.string().min(1),
				therapist_gender_preference: z.enum(['male', 'female', 'no_preference']).optional(),
				notes: z.string().max(500).optional(),
				pregnant: z.boolean().optional(),
				guest_conditions: z.array(z.string()).optional(),
				party_size: z.number().int().positive().optional()
			}
		},
		async (input) => {
			const service = SPA_SERVICES.find((item) => item.id === input.service_id);
			if (!service) return textResult({ ok: false, reason: 'unknown_service', availableSlots: [] });

			const guard = guardBooking({
				date: input.date,
				time: input.time,
				contraindications: service.contraindications,
				maxPartySize: service.maxPartySize,
				partySize: input.party_size,
				pregnant: input.pregnant,
				guestConditions: input.guest_conditions
			});
			if (!guard.ok) return textResult({ ok: false, rejected: true, code: guard.code, reason: guard.reason });

			const slots = await availability(env, input.service_id, input.date);
			const selected = slots.find((slot) => slot.time === input.time);
			if (!selected?.isAvailable) {
				return textResult({
					ok: false,
					reason: selected ? 'slot_not_available' : 'invalid_time',
					availableSlots: slots.filter((slot) => slot.isAvailable).map((slot) => slot.time)
				});
			}

			const confirmationCode = `SPA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
			try {
				await env.SPA_DB.prepare(
					`INSERT INTO spa_bookings
					 (confirmation_code, service_id, room_id, booking_date, booking_time,
					  therapist_gender_preference, notes)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
				)
					.bind(
						confirmationCode,
						input.service_id,
						input.room_id,
						input.date,
						input.time,
						input.therapist_gender_preference ?? null,
						input.notes ?? null
					)
					.run();
			} catch {
				const refreshed = await availability(env, input.service_id, input.date);
				return textResult({
					ok: false,
					reason: 'slot_not_available',
					availableSlots: refreshed.filter((slot) => slot.isAvailable).map((slot) => slot.time)
				});
			}

			return textResult({
				ok: true,
				confirmationCode,
				serviceId: input.service_id,
				roomId: input.room_id,
				date: input.date,
				time: input.time
			});
		}
	);

	server.registerTool(
		'cancel_spa_booking',
		{
			description: 'Cancel a spa booking by confirmation code.',
			inputSchema: { booking_id: z.string().min(1) }
		},
		async ({ booking_id }) => {
			const result = await env.SPA_DB.prepare(
				`UPDATE spa_bookings
				 SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
				 WHERE confirmation_code = ?1 AND status = 'confirmed'`
			)
				.bind(booking_id)
				.run();
			return textResult({ success: (result.meta.changes ?? 0) > 0, bookingId: booking_id });
		}
	);

	return server;
}

async function secureEqual(actual: string, expected: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [actualHash, expectedHash] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(actual)),
		crypto.subtle.digest('SHA-256', encoder.encode(expected))
	]);
	const left = new Uint8Array(actualHash);
	const right = new Uint8Array(expectedHash);
	let difference = 0;
	for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
	return difference === 0;
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
	if (!env.MCP_API_TOKEN) return false;
	const authorization = request.headers.get('authorization') ?? '';
	return secureEqual(authorization, `Bearer ${env.MCP_API_TOKEN}`);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === '/health' && request.method === 'GET') {
			return Response.json({ status: 'ok', service: 'spa', storage: 'd1' });
		}

		if (url.pathname !== '/api/mcp') return new Response('Not found', { status: 404 });
		if (!(await isAuthorized(request, env))) return new Response('Unauthorized', { status: 401 });

		const handler = createMcpHandler(() => createServer(env), {
			responseMode: 'json',
			corsOptions: false
		});

		// The Agents SDK handler defaults to `/mcp`. Keep AllStay's public
		// `/api/mcp` contract, but normalize the internal transport URL so the
		// deployed bundle does not depend on custom-route option handling.
		const transportUrl = new URL(request.url);
		transportUrl.pathname = '/mcp';
		return handler(new Request(transportUrl, request), env, ctx);
	}
} satisfies ExportedHandler<Env>;
