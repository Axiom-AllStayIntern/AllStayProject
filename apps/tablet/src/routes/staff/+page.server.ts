import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { listWorkOrders, markWorkOrderConfirmed } from '$lib/ai/staff/notify.js';

// Staff-facing SPA desk view: the Bahasa work orders produced when guests
// confirm a spa booking via the concierge. The "confirm into Cakrasoft" action
// is the human-in-the-loop final keystroke (mock — flips local status only).
export const load: PageServerLoad = async () => {
	return { orders: listWorkOrders() };
};

export const actions: Actions = {
	confirm: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		if (!id || !markWorkOrderConfirmed(id)) {
			return fail(400, { id, ok: false });
		}
		return { id, ok: true };
	}
};
