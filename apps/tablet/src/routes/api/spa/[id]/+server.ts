import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callMcpTool } from '$lib/ai/tools/mcp-client.js';

export const POST: RequestHandler = async ({ request, params }) => {
	const body = await request.json();

	const result = await callMcpTool({
		server: 'spa',
		tool: 'create_spa_booking',
		params: {
			service_id: params.id,
			room_id: body.roomId,
			date: body.date,
			time: body.time,
			therapist_gender_preference: body.therapistGenderPreference ?? 'no_preference',
			notes: body.notes ?? ''
		}
	});

	if (!result.success) throw error(500, result.error ?? 'Spa booking failed');
	return json(result.data);
};
