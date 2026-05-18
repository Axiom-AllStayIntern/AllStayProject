import type { PageServerLoad } from './$types';
import type { Restaurant } from '$types/restaurant.js';

export const load: PageServerLoad = async ({ fetch }) => {
	// TODO: fetch from restaurant MCP server via /api/booking
	const restaurants: Restaurant[] = [];
	return { restaurants };
};
