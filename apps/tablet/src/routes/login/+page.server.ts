import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import crypto from 'crypto';

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const staffId = data.get('staffId')?.toString().trim() ?? '';
		const pin = data.get('pin')?.toString().trim() ?? '';

		if (!staffId || !pin) {
			return fail(400, { error: 'Staff ID and PIN are required.' });
		}

		// TODO: validate staffId + pin against Cakrasoft PMS staff table
		const isValid = staffId.length > 0 && /^\d{4,6}$/.test(pin);

		if (!isValid) {
			return fail(401, { error: 'Invalid credentials.' });
		}

		const token = crypto.randomBytes(32).toString('hex');
		cookies.set('session_token', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 12 // 12h
		});

		throw redirect(303, '/room-select');
	}
};
