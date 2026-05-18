import type { PageServerLoad } from './$types';
import type { SpaService } from '$types/spa.js';

export const load: PageServerLoad = async ({ fetch }) => {
	const res = await fetch('/api/spa');
	const data = await res.json();
	return {
		services: (data.services ?? []) as SpaService[]
	};
};
