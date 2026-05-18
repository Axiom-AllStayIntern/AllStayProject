<script lang="ts">
	import { cartItemCount } from '$lib/stores/cart.js';
</script>

{#if $cartItemCount > 0}
	<span class="badge">{$cartItemCount > 99 ? '99+' : $cartItemCount}</span>
{/if}

<style>
	.badge {
		position: absolute;
		top: -6px;
		right: -8px;
		background: var(--color-primary);
		color: #000;
		font-size: 10px;
		font-weight: 700;
		min-width: 16px;
		height: 16px;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 3px;
	}
</style>
