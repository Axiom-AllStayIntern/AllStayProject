<script lang="ts">
	import { formatPrice } from '$lib/utils/format.js';
	import DateTimePicker from '$lib/components/DateTimePicker.svelte';
	import type { TransportOption } from '$types/transport.js';
	import type { PageData } from './$types';
	import { _ } from 'svelte-i18n';

	export let data: PageData;

	let selected: TransportOption | null = null;
	let date = '';
	let time = '';
	let destination = '';
</script>

<div class="transport">
	<h1 class="page-title">{$_('transport.title')}</h1>
	<div class="options">
		{#each data.options as opt}
			<button class="option-card" on:click={() => selected = opt}>
				<div class="option-card__info">
					<p class="option-card__name">{opt.name}</p>
					<p class="option-card__desc">{opt.description}</p>
					<p class="option-card__capacity">{$_('transport.capacity', { values: { count: opt.capacity } })}</p>
				</div>
				<p class="option-card__price">{formatPrice(opt.price)}</p>
			</button>
		{/each}
	</div>
</div>

<style>
	.transport { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 24px; }
	.options { display: flex; flex-direction: column; gap: 12px; }
	.option-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		text-align: left;
	}
	.option-card__name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
	.option-card__desc { font-size: 13px; color: var(--color-text-muted); }
	.option-card__capacity { font-size: 12px; color: var(--color-text-muted); margin-top: 4px; }
	.option-card__price { color: var(--color-primary); font-size: 16px; font-weight: 700; flex-shrink: 0; }
</style>
