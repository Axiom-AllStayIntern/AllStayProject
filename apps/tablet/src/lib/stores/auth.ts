import { writable, derived } from 'svelte/store';

interface AuthState {
	staffId: string | null;
	token: string | null;
	isLoggedIn: boolean;
}

const initialState: AuthState = {
	staffId: null,
	token: null,
	isLoggedIn: false
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>(initialState);

	return {
		subscribe,
		login(staffId: string, token: string) {
			set({ staffId, token, isLoggedIn: true });
			// TODO: persist to Capacitor Secure Storage
		},
		logout() {
			set(initialState);
			// TODO: clear Capacitor Secure Storage
		},
		loadFromStorage() {
			// TODO: restore from Capacitor Secure Storage on app start
		}
	};
}

export const auth = createAuthStore();
export const isLoggedIn = derived(auth, ($auth) => $auth.isLoggedIn);
