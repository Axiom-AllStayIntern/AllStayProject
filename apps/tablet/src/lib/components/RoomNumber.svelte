<script lang="ts">
	import { roomNumber } from '$lib/stores/room.js';
	import { _ } from 'svelte-i18n';
</script>

{#if $roomNumber}
	<div class="room-number">
		<span class="label">{$_('home.roomNumber', { values: { room: $roomNumber } })}</span>
	</div>
{/if}

<style>
	.room-number {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: var(--color-surface-raised);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		padding: 4px 14px;
	}
	.label {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-primary);
	}
</style>
