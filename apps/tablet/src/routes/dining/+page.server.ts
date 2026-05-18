import type { PageServerLoad } from './$types';
import type { MenuCategory } from '$types/menu.js';

export const load: PageServerLoad = async ({ fetch }) => {
	const res = await fetch('/api/menu');
	const data = await res.json();
	return {
		categories: (data.categories ?? []) as MenuCategory[]
	};
};
