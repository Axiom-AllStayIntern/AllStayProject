<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Screensaver from '$lib/components/Screensaver.svelte';
	import AiBanner from '$lib/components/AiBanner.svelte';
	import VoiceAssistant from '$lib/components/VoiceAssistant.svelte';
	import { idle } from '$lib/stores/idle.js';
	import { toasts } from '$lib/stores/toast.js';
	import { voiceReply } from '$lib/stores/voice-reply.js';
	import { cart } from '$lib/stores/cart.js';
	import { roomNumber } from '$lib/stores/room.js';
	import { language } from '$lib/stores/language.js';
	import { onMount } from 'svelte';
	import { setupI18n } from '$lib/i18n/index.js';
	import type { AIResponse } from '$lib/services/ai-conversation.js';

	setupI18n();

	const STANDALONE = ['/login', '/room-select', '/confirmation', '/staff'];
	$: isStandalone = STANDALONE.some((p) => $page.url.pathname.startsWith(p));

	onMount(() => {
		if (!isStandalone) idle.start();
		return () => idle.stop();
	});

	async function handleVoiceResult(response: AIResponse) {
		if (!response.text) return;

		if (response.action?.type === 'navigate') {
			voiceReply.set({ message: response.text, intent: response.action.payload.route });
			await goto(response.action.payload.route);
		} else if (response.action?.type === 'cart_remove') {
			removeCartItem(response.action.payload.itemName);
			voiceReply.set({ message: response.text, intent: null });
		} else {
			voiceReply.set({ message: response.text, intent: null });
			if (response.agentData) syncCartItem(response.agentData);
		}
	}

	function removeCartItem(itemName: string | null) {
		const items = $cart.items;
		if (!items.length) return;

		if (!itemName) {
			// "刚才那个不要了" → remove the last added item
			cart.removeItem(items[items.length - 1].id);
			return;
		}
		// Match by name — try exact first, then partial
		const kw = itemName.toLowerCase();
		const match =
			items.find(i => i.name.toLowerCase() === kw) ??
			items.find(i => i.name.toLowerCase().includes(kw) || kw.includes(i.name.toLowerCase()));
		if (match) cart.removeItem(match.id);
	}

	function syncCartItem(data: unknown) {
		// Agent returns whatever the MCP server echoes back.
		// Best-effort: if it has itemId / name / price we can mirror it locally.
		const d = data as Record<string, unknown> | null;
		if (!d) return;
		const roomId = $roomNumber ?? 'guest';
		try {
			cart.addItem(roomId, {
				source: 'dining',
				itemId: String(d.item_id ?? d.itemId ?? ''),
				name: String(d.name ?? d.item_name ?? 'Item'),
				price: Number(d.price ?? d.unit_price ?? 0),
				quantity: Number(d.quantity ?? 1),
				specialInstructions: String(d.special_instructions ?? '')
			});
		} catch {
			// MCP response shape unknown — cart will be refreshed when user opens /cart
		}
	}
</script>

<Screensaver />

<slot />

{#if !isStandalone}
	<AiBanner />
	<VoiceAssistant onResult={handleVoiceResult} />
{/if}

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
