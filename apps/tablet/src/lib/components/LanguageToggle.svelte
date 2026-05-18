<script lang="ts">
	import { language } from '$lib/stores/language.js';
</script>

<button class="lang-toggle" on:click={() => language.toggle()}>
	<span class:active={$language === 'en'}>EN</span>
	<span class="divider">/</span>
	<span class:active={$language === 'zh'}>中</span>
</button>

<style>
	.lang-toggle {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--color-text-muted);
		font-size: 14px;
		font-weight: 500;
		padding: 6px 10px;
		border-radius: 8px;
		border: 1px solid var(--color-border);
		background: var(--color-surface-raised);
	}
	span { transition: color 0.15s; }
	.active { color: var(--color-primary); font-weight: 700; }
	.divider { color: var(--color-border); }
</style>
