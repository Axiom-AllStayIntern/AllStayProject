<script lang="ts">
	import { goto } from '$app/navigation';
	import { cartItemCount } from '$lib/stores/cart.js';
</script>

<button class="cart-icon" on:click={() => goto('/cart')} aria-label="Shopping cart">
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
		<circle cx="9" cy="21" r="1" />
		<circle cx="20" cy="21" r="1" />
		<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
	</svg>
	{#if $cartItemCount > 0}
		<span class="badge">{$cartItemCount > 99 ? '99+' : $cartItemCount}</span>
	{/if}
</button>

<style>
	.cart-icon {
		position: relative;
		color: var(--color-text);
		padding: 8px;
	}
	.badge {
		position: absolute;
		top: 0;
		right: 0;
		background: var(--color-primary);
		color: #000;
		font-size: 10px;
		font-weight: 700;
		min-width: 18px;
		height: 18px;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px;
	}
</style>
