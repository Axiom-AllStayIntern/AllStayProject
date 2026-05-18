<script lang="ts">
	export let value = 1;
	export let min = 1;
	export let max = 99;

	function decrement() { if (value > min) value -= 1; }
	function increment() { if (value < max) value += 1; }
</script>

<div class="qty">
	<button class="qty__btn" on:click={decrement} disabled={value <= min}>−</button>
	<span class="qty__value">{value}</span>
	<button class="qty__btn" on:click={increment} disabled={value >= max}>+</button>
</div>

<style>
	.qty {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--color-surface-raised);
		border-radius: 12px;
		padding: 4px;
	}
	.qty__btn {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		background: var(--color-border);
		color: var(--color-text);
		font-size: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}
	.qty__btn:disabled { opacity: 0.3; }
	.qty__value {
		width: 36px;
		text-align: center;
		font-size: 18px;
		font-weight: 600;
	}
</style>
