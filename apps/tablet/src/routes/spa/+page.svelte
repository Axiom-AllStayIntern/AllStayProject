<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { language } from '$lib/stores/language.js';
	import { formatPrice } from '$lib/utils/format.js';
	import DateTimePicker from '$lib/components/DateTimePicker.svelte';
	import type { SpaService } from '$types/spa.js';
	import type { PageData } from './$types';

	export let data: PageData;

	let selectedService: SpaService | null = null;
	let bookingDate = '';
	let bookingTime = '';
	let showBooking = false;

	function selectService(service: SpaService) {
		selectedService = service;
		showBooking = true;
	}

	async function submitBooking() {
		if (!selectedService || !bookingDate || !bookingTime) return;
		await fetch(`/api/spa/${selectedService.id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ date: bookingDate, time: bookingTime })
		});
		showBooking = false;
	}
</script>

<div class="spa">
	<h1 class="page-title">{$_('spa.title')}</h1>

	<div class="service-list">
		{#each data.services as service}
			<div class="service-card">
				{#if service.imageUrl}
					<img src={service.imageUrl} alt={service.name[$language]} class="service-card__img" />
				{/if}
				<div class="service-card__body">
					<h3 class="service-card__name">{service.name[$language]}</h3>
					<p class="service-card__desc">{service.description[$language]}</p>
					<div class="service-card__meta">
						<span>{$_('spa.duration', { values: { min: service.duration } })}</span>
						<span class="price">{formatPrice(service.price)}</span>
					</div>
					<button class="btn-book" on:click={() => selectService(service)} disabled={!service.isAvailable}>
						{$_('spa.bookNow')}
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>

{#if showBooking && selectedService}
	<div class="booking-overlay" role="dialog">
		<div class="booking-modal">
			<h2>{selectedService.name[$language]}</h2>
			<DateTimePicker bind:date={bookingDate} bind:time={bookingTime} />
			<button class="btn-confirm" on:click={submitBooking} disabled={!bookingDate || !bookingTime}>
				{$_('common.confirm')}
			</button>
			<button class="btn-cancel" on:click={() => showBooking = false}>{$_('common.cancel')}</button>
		</div>
	</div>
{/if}

<style>
	.spa { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 24px; }
	.service-list { display: flex; flex-direction: column; gap: 16px; }
	.service-card {
		display: flex;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		overflow: hidden;
	}
	.service-card__img { width: 140px; object-fit: cover; flex-shrink: 0; }
	.service-card__body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
	.service-card__name { font-size: 18px; font-weight: 700; }
	.service-card__desc { font-size: 13px; color: var(--color-text-muted); flex: 1; }
	.service-card__meta { display: flex; justify-content: space-between; color: var(--color-text-muted); font-size: 13px; }
	.price { color: var(--color-primary); font-weight: 600; }
	.btn-book {
		align-self: flex-start;
		background: var(--color-primary);
		color: #000;
		font-weight: 700;
		padding: 10px 20px;
		border-radius: 10px;
		font-size: 14px;
	}
	.btn-book:disabled { opacity: 0.4; }
	.booking-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
	}
	.booking-modal {
		background: var(--color-surface);
		border-radius: 20px;
		padding: 32px;
		width: 480px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.btn-confirm {
		background: var(--color-primary);
		color: #000;
		font-weight: 700;
		padding: 14px;
		border-radius: 12px;
		font-size: 16px;
	}
	.btn-cancel { color: var(--color-text-muted); padding: 8px; }
</style>
