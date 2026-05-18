import { writable } from 'svelte/store';
import { goto } from '$app/navigation';
import { auth } from './auth.js';
import { cart } from './cart.js';
import { room } from './room.js';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function createIdleStore() {
	const { subscribe, set } = writable(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	function reset() {
		if (timer) clearTimeout(timer);
		set(false);
		timer = setTimeout(triggerScreensaver, IDLE_TIMEOUT_MS);
	}

	function triggerScreensaver() {
		set(true);
	}

	function onActivity() {
		set(false);
		reset();
	}

	function dismissScreensaver() {
		set(false);
		cart.clear();
		room.clearRoom();
		auth.logout();
		goto('/login');
	}

	return {
		subscribe,
		start() {
			const events = ['touchstart', 'mousedown', 'keypress', 'scroll'];
			events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
			reset();
		},
		stop() {
			if (timer) clearTimeout(timer);
			set(false);
		},
		dismiss: dismissScreensaver
	};
}

export const idle = createIdleStore();
