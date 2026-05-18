<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { goto } from '$app/navigation';

	const sections = [
		{ path: '/explore/activities', icon: '🏄', label: 'Activities', desc: 'Surf, hike, culture' },
		{ path: '/explore/restaurants', icon: '🍜', label: 'Local Dining', desc: 'Off-property restaurants' },
		{ path: '/explore/spa', icon: '🌸', label: 'Wellness', desc: 'External spa & yoga' },
		{ path: '/explore/transport', icon: '🚗', label: 'Transport', desc: 'Airport, day trips' }
	];
</script>

<div class="explore">
	<h1 class="page-title">{$_('explore.title')}</h1>
	<div class="grid">
		{#each sections as s}
			<button class="explore-card" on:click={() => goto(s.path)}>
				<span class="explore-card__icon">{s.icon}</span>
				<p class="explore-card__label">{s.label}</p>
				<p class="explore-card__desc">{s.desc}</p>
			</button>
		{/each}
	</div>
</div>

<style>
	.explore { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 24px; }
	.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
	.explore-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		padding: 28px 20px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		text-align: left;
	}
	.explore-card__icon { font-size: 36px; }
	.explore-card__label { font-size: 18px; font-weight: 700; }
	.explore-card__desc { font-size: 13px; color: var(--color-text-muted); }
</style>
