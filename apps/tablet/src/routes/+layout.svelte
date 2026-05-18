<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Screensaver from '$lib/components/Screensaver.svelte';
	import { idle } from '$lib/stores/idle.js';
	import { onMount } from 'svelte';
	import { setupI18n } from '$lib/i18n/index.js';
	import { toasts } from '$lib/stores/toast.js';
	import type { Toast } from '$lib/stores/toast.js';

	setupI18n();

	const STANDALONE = ['/login', '/room-select', '/confirmation'];
	$: isStandalone = STANDALONE.some((p) => $page.url.pathname.startsWith(p));

	onMount(() => {
		if (!isStandalone) idle.start();
		return () => idle.stop();
	});
</script>

<Screensaver />

<slot />

<!-- Toast container -->
<div class="toast-container" aria-live="polite">
	{#each $toasts as toast (toast.id)}
		<div class="toast toast--{toast.type}" role="status">
			{toast.message}
			<button class="toast-close" on:click={() => toasts.removeToast(toast.id)} aria-label="Dismiss">✕</button>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 10px;
		z-index: 9000;
		width: min(480px, calc(100vw - 40px));
		pointer-events: none;
	}

	.toast {
		pointer-events: all;
		border-radius: 12px;
		padding: 14px 18px;
		font-size: 14px;
		line-height: 1.5;
		color: #fff;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
		animation: slide-in 0.25s ease;
	}

	.toast--info    { background: #1a2744; }
	.toast--success { background: #2e7d32; }
	.toast--error   { background: #c62828; }

	.toast-close {
		margin-left: auto;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		font-size: 12px;
		padding: 0;
		flex-shrink: 0;
		line-height: 1;
	}

	@keyframes slide-in {
		from { opacity: 0; transform: translateY(-10px); }
		to   { opacity: 1; transform: translateY(0); }
	}
</style>
