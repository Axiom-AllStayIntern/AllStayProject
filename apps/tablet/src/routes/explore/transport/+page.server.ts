import type { PageServerLoad } from './$types';
import type { TransportOption } from '$types/transport.js';

export const load: PageServerLoad = async ({ fetch }) => {
	const res = await fetch('/api/transport');
	const data = await res.json();
	return { options: (data.options ?? []) as TransportOption[] };
};
