<script lang="ts">
	export let date = '';
	export let time = '';
	export let minDate = new Date().toISOString().split('T')[0];

	// Available time slots — in production these come from MCP Server availability check
	const TIME_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
</script>

<div class="picker">
	<div class="picker__group">
		<label class="picker__label">Date</label>
		<input
			type="date"
			class="picker__input"
			bind:value={date}
			min={minDate}
		/>
	</div>
	<div class="picker__group">
		<label class="picker__label">Time</label>
		<div class="time-grid">
			{#each TIME_SLOTS as slot}
				<button
					class="time-slot"
					class:time-slot--selected={time === slot}
					on:click={() => time = slot}
				>
					{slot}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.picker { display: flex; flex-direction: column; gap: 20px; }
	.picker__group { display: flex; flex-direction: column; gap: 8px; }
	.picker__label { font-size: 13px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
	.picker__input {
		background: var(--color-surface-raised);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		color: var(--color-text);
		font-size: 16px;
		padding: 12px 16px;
	}
	.time-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
	.time-slot {
		padding: 10px 0;
		border-radius: 10px;
		background: var(--color-surface-raised);
		border: 1px solid var(--color-border);
		color: var(--color-text);
		font-size: 14px;
	}
	.time-slot--selected {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: #000;
		font-weight: 700;
	}
</style>
