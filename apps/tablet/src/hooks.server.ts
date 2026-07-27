import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const publicPaths = ['/login', '/api/auth'];
	const isPublic = publicPaths.some((p) => event.url.pathname.startsWith(p));

	if (!isPublic) {
		const token = event.cookies.get('session_token');
		if (token) {
			// TODO: verify token against session store
			event.locals.staffId = 'staff_from_token';
			event.locals.token = token;
		}
	}

	const response = await resolve(event);
	return response;
};
