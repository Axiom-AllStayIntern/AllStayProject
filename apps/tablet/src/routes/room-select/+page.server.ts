import type { PageServerLoad } from './$types';
// Room selection is handled client-side (room store + goto('/home'))
// This file just satisfies SvelteKit's +page.server.ts requirement
export const load: PageServerLoad = async () => ({});
