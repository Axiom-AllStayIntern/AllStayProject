<script lang="ts">
	import type { PageData } from './$types';
	import { _ } from 'svelte-i18n';
	export let data: PageData;
</script>

<div class="amenities">
	<h1 class="page-title">{$_('amenities.title')}</h1>
	<div class="grid">
		{#each data.amenities as a}
			<div class="card">
				<span class="card__icon">{a.icon}</span>
				<div>
					<p class="card__name">{a.name}</p>
					<p class="card__hours">{a.hours}</p>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.amenities { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 24px; }
	.grid { display: flex; flex-direction: column; gap: 12px; }
	.card {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 20px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 14px;
	}
	.card__icon { font-size: 28px; }
	.card__name { font-size: 16px; font-weight: 600; }
	.card__hours { font-size: 13px; color: var(--color-text-muted); }
</style>
