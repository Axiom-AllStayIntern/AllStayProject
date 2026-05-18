<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let value = '';
	export let maxLength = 4;

	const dispatch = createEventDispatcher<{ confirm: string }>();

	const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

	function press(key: string) {
		if (key === '⌫') {
			value = value.slice(0, -1);
		} else if (key && value.length < maxLength) {
			value += key;
		}
	}
</script>

<div class="keypad">
	{#each keys as key}
		<button
			class="key"
			class:key--empty={!key}
			class:key--backspace={key === '⌫'}
			on:click={() => press(key)}
			disabled={!key}
		>
			{key}
		</button>
	{/each}
	<button class="key key--confirm" on:click={() => dispatch('confirm', value)}>
		✓
	</button>
</div>

<style>
	.keypad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		max-width: 320px;
	}
	.key {
		height: 72px;
		border-radius: 16px;
		background: var(--color-surface-raised);
		color: var(--color-text);
		font-size: 24px;
		font-weight: 600;
		border: 1px solid var(--color-border);
		transition: background 0.1s;
	}
	.key:active { background: var(--color-border); }
	.key--empty { background: transparent; border-color: transparent; pointer-events: none; }
	.key--confirm {
		background: var(--color-primary);
		color: #000;
		border-color: var(--color-primary);
	}
</style>
