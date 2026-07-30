<script lang="ts">
	import { page } from '$app/stores';
	import { cartItemCount } from '$lib/stores/cart.js';
	import { _ } from 'svelte-i18n';

	const tabs = [
		{
			path: '/home', key: 'home',
			icon: `<path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/>`
		},
		{
			path: '/dining', key: 'dining',
			icon: `<path d="M4 3v18M4 12h6c1 0 2-1 2-2V4M18 3v8a3 3 0 0 1-3 3v7"/>`
		},
		{
			path: '/spa', key: 'spa',
			icon: `<path d="M12 2c2 4-2 4 0 8s-2 4 0 8M5 8c2 4-2 4 0 8M19 8c2 4-2 4 0 8"/>`
		},
		{
			path: '/restaurants', key: 'restaurants',
			icon: `<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3"/>`
		},
		{
			path: '/explore', key: 'explore',
			icon: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>`
		},
		{
			path: '/cart', key: 'cart', hasCart: true,
			icon: `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>`
		}
	];

	$: current = $page.url.pathname;
</script>

<nav class="tabs">
	{#each tabs as tab}
		{@const active = current.startsWith(tab.path)}
		<a href={tab.path} class="tab" class:on={active}>
			<span class="tab-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
					{@html tab.icon}
				</svg>
				{#if tab.hasCart && $cartItemCount > 0}
					<span class="tab-badge">{$cartItemCount > 99 ? '99+' : $cartItemCount}</span>
				{/if}
			</span>
			<span class="tab-label">{$_(`nav.${tab.key}`)}</span>
		</a>
	{/each}
</nav>

<div class="navbar">
	<i class="nb back"></i><i class="nb home"></i><i class="nb recent"></i>
</div>

<style>
	.tabs {
		flex-shrink: 0;
		display: grid; grid-template-columns: repeat(6, 1fr);
		background: var(--white);
		border-top: 1px solid var(--line);
		padding: 8px 4px 8px;
		gap: 2px;
	}
	.tab {
		background: none; border: none; cursor: pointer;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		gap: 4px; padding: 8px 4px;
		min-height: 56px;
		color: var(--ink-3);
		font: 500 10.5px/1 var(--font-ui);
		letter-spacing: .02em;
		border-radius: var(--r-sm);
		transition: color .15s;
		text-decoration: none;
	}
	.tab-icon {
		position: relative; display: flex; align-items: center; justify-content: center;
	}
	.tab-icon svg { width: 22px; height: 22px; stroke-width: 1.6; }
	.tab-label { font-size: 10.5px; }

	.tab.on { color: var(--navy-800); }
	.tab.on .tab-label { font-weight: 600; }
	.tab.on svg { color: var(--gold-600); }

	.tab-badge {
		position: absolute; top: -6px; right: -8px;
		background: var(--warn); color: #fff;
		border-radius: var(--r-pill);
		min-width: 16px; height: 16px; padding: 0 4px;
		font: 700 10px/16px var(--font-ui);
		display: flex; align-items: center; justify-content: center;
	}

	.navbar {
		height: 36px; flex-shrink: 0;
		display: flex; align-items: center; justify-content: center; gap: 64px;
		background: rgba(255,255,255,.5); backdrop-filter: blur(8px);
		border-top: 1px solid rgba(0,0,0,.04);
	}
</style>
