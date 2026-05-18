import type { PageServerLoad } from './$types';
import type { MenuItem } from '$types/menu.js';

export const load: PageServerLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/menu?category=${params.category}`);
	const data = await res.json();
	return {
		categoryId: params.category,
		items: (data.items ?? []) as MenuItem[]
	};
};
