import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'info' | 'success' | 'error';
	duration: number;
}

interface AddToastOptions {
	message: string;
	type?: Toast['type'];
	duration?: number;
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	function addToast({ message, type = 'info', duration = 5000 }: AddToastOptions) {
		const id = crypto.randomUUID();
		// Keep at most 3 toasts; drop oldest if full
		update((toasts) => [...toasts.slice(-2), { id, message, type, duration }]);
		setTimeout(() => removeToast(id), duration);
	}

	function removeToast(id: string) {
		update((toasts) => toasts.filter((t) => t.id !== id));
	}

	return { subscribe, addToast, removeToast };
}

export const toasts = createToastStore();
export const addToast = toasts.addToast;
