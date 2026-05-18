import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_PATHS = ['/login', '/room-select'];

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const isPublic = PUBLIC_PATHS.some((p) => url.pathname.startsWith(p));

	if (!isPublic && !locals.staffId) {
		throw redirect(303, '/login');
	}

	return {
		staffId: locals.staffId ?? null
	};
};
