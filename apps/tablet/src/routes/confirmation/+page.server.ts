import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	return {
		orderId: url.searchParams.get('orderId') ?? ''
	};
};
