<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { language } from '$lib/stores/language.js';
	import DateTimePicker from '$lib/components/DateTimePicker.svelte';
	import type { Restaurant } from '$types/restaurant.js';
	import type { PageData } from './$types';

	export let data: PageData;

	let selected: Restaurant | null = null;
	let date = '';
	let time = '';
	let partySize = 2;
</script>

<div class="restaurants">
	<h1 class="page-title">{$_('restaurants.title')}</h1>
	<div class="list">
		{#each data.restaurants as r}
			<div class="restaurant-card">
				{#if r.imageUrl}
					<img src={r.imageUrl} alt={r.name[$language]} class="restaurant-card__img" />
				{/if}
				<div class="restaurant-card__body">
					<h3>{r.name[$language]}</h3>
					<p class="muted">{r.description[$language]}</p>
					<p class="hours">{r.openHours}</p>
					<button class="btn-reserve" on:click={() => selected = r} disabled={!r.isOpen}>
						{$_('restaurants.reserveTable')}
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.restaurants { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 24px; }
	.list { display: flex; flex-direction: column; gap: 16px; }
	.restaurant-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		overflow: hidden;
		display: flex;
	}
	.restaurant-card__img { width: 140px; object-fit: cover; }
	.restaurant-card__body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
	.muted { color: var(--color-text-muted); font-size: 13px; }
	.hours { color: var(--color-text-muted); font-size: 12px; }
	.btn-reserve {
		align-self: flex-start;
		background: var(--color-primary);
		color: #000;
		font-weight: 700;
		padding: 10px 20px;
		border-radius: 10px;
		font-size: 14px;
	}
</style>
