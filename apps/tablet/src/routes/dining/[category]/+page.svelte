<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { language, localize, type LocalizedText } from '$lib/stores/language.js';
	import { cart } from '$lib/stores/cart.js';
	import { roomNumber } from '$lib/stores/room.js';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { formatPrice } from '$lib/utils/format.js';
	import type { MenuItem } from '$types/menu.js';
	import type { PageData } from './$types';

	export let data: PageData;

	let selectedItem: MenuItem | null = null;
	let sheetOpen = false;

	function openItem(item: MenuItem) {
		selectedItem = item;
		sheetOpen = true;
	}

	function handleAdd(e: CustomEvent<{ item: { id: string; name: LocalizedText; price: number }; quantity: number; specialInstructions: string }>) {
		const { item, quantity, specialInstructions } = e.detail;
		cart.addItem($roomNumber ?? '', {
			source: 'dining',
			itemId: item.id,
			name: localize(item.name, $language),
			price: item.price,
			quantity,
			specialInstructions
		});
	}
</script>

<div class="menu">
	<div class="menu__list">
		{#each data.items as item}
			<button class="menu-item" on:click={() => openItem(item)} disabled={!item.isAvailable}>
				<div class="menu-item__info">
					<p class="menu-item__name">{localize(item.name, $language)}</p>
					<p class="menu-item__desc">{localize(item.description, $language)}</p>
					<p class="menu-item__price">{formatPrice(item.price)}</p>
				</div>
				{#if item.imageUrl}
					<img src={item.imageUrl} alt={localize(item.name, $language)} class="menu-item__img" />
				{/if}
			</button>
		{/each}
	</div>
</div>

<BottomSheet item={selectedItem} bind:open={sheetOpen} on:add={handleAdd} on:close={() => sheetOpen = false} />

<style>
	.menu { padding: 16px 24px; }
	.menu__list { display: flex; flex-direction: column; gap: 1px; }
	.menu-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 16px 0;
		border-bottom: 1px solid var(--color-border);
		text-align: left;
		width: 100%;
	}
	.menu-item:disabled { opacity: 0.4; }
	.menu-item__info { flex: 1; }
	.menu-item__name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
	.menu-item__desc { font-size: 13px; color: var(--color-text-muted); margin-bottom: 6px; line-height: 1.4; }
	.menu-item__price { font-size: 15px; font-weight: 600; color: var(--color-primary); }
	.menu-item__img { width: 80px; height: 80px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
</style>
