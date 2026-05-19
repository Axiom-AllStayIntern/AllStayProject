<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { language } from '$lib/stores/language.js';
	import { formatPrice } from '$lib/utils/format.js';
	import type { PageData } from './$types';

	export let data: PageData;

	// ── Bottom sheet state ─────────────────────────────────────
	let sheetItem: any = null;
	let sheetDate = 'today';
	let sheetTime = '';
	let sheetParty = 2;
	let sheetNote = '';

	function openSheet(venue: any) {
		sheetItem = venue;
		sheetDate = 'today';
		sheetTime = '';
		sheetParty = 2;
		sheetNote = '';
	}
	function closeSheet() { sheetItem = null; }

	function getTimeSlots(from: number, to: number): string[] {
		const slots: string[] = [];
		for (let h = Math.ceil(from); h <= Math.min(22, to); h++) {
			slots.push(`${String(h % 24).padStart(2,'0')}:00`);
			if (h + 0.5 <= to) slots.push(`${String(h % 24).padStart(2,'0')}:30`);
		}
		return slots.slice(0, 12);
	}

	$: timeSlots = sheetItem ? getTimeSlots(sheetItem.openFrom, sheetItem.openTo) : [];
	$: takenSlots = sheetItem ? [timeSlots[2], timeSlots[5]].filter(Boolean) : [];

	async function submitReservation() {
		if (!sheetItem || !sheetDate || !sheetTime) return;
		await fetch('/api/booking', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ restaurantId: sheetItem.id, date: sheetDate, time: sheetTime, partySize: sheetParty, notes: sheetNote })
		});
		closeSheet();
	}

	// Cover gradient map
	const COVER_BG: Record<string, string> = {
		v1: 'repeating-linear-gradient(135deg, #1a2744 0 12px, #243559 12px 24px)',
		v2: 'repeating-linear-gradient(135deg, #6e3a2d 0 12px, #8a4b3b 12px 24px)',
		v3: 'repeating-linear-gradient(135deg, #2c5d4f 0 12px, #3a7560 12px 24px)'
	};
</script>

<div class="shell">
<Header />
<main class="main scroll">
<div class="page-enter">

<!-- ── Page content ─────────────────────────────────────────── -->
<div class="page-hero">
	<div class="eyebrow">Reserve a table</div>
	<h2>Hotel Restaurants</h2>
	<p>Three signature venues across the resort. Bookings confirmed within 5 minutes.</p>
</div>

<div class="venue-list">
	{#each data.restaurants as v}
		<div class="venue-card">
			<div class="cover">
				{#if v.imageUrl}
					<img src={v.imageUrl} alt={v.name.en} loading="lazy" on:error={(e) => { e.currentTarget.style.display = 'none'; }} />
				{/if}
				<div class="badges">
					{#if v.isOpen}
						<span class="pill success">Open now</span>
					{:else}
						<span class="pill warn">Closed</span>
					{/if}
				</div>
			</div>
			<div class="body">
				<div class="cuisine">{v.cuisine[$language]}</div>
				<div class="vname">
					{v.name[$language]}
					{#if $language === 'en'}<span class="cn">{v.name.zh}</span>{/if}
				</div>
				<div class="vmeta">
					<span class="pill">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
						{v.openHours}
					</span>
				</div>
				<p class="vdesc">{v.description[$language]}</p>
				<div class="actions">
					<button class="btn-ghost">View menu</button>
					<button class="btn-add" on:click={() => openSheet(v)} disabled={!v.isOpen}>Reserve</button>
				</div>
			</div>
		</div>
	{/each}
</div>

</div><!-- /page-enter -->
</main>
<BottomNav />
</div><!-- /shell -->

<!-- ── Bottom sheet ─────────────────────────────────────────── -->
{#if sheetItem}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="sheet-mask show" on:click={closeSheet}></div>
	<div class="sheet show" role="dialog" aria-modal="true">
		<div class="grabber"></div>
		<div class="sheet-body">
			<div class="big-thumb">
				{#if sheetItem.imageUrl}
					<img src={sheetItem.imageUrl} alt={sheetItem.name.en} />
				{/if}
			</div>
			<div class="sheet-cuisine">{sheetItem.cuisine[$language]}</div>
			<h3>{sheetItem.name[$language]}</h3>
			<p class="sheet-desc">{sheetItem.description[$language]}</p>

			<div class="field-block">
				<span class="lbl">Dining date</span>
				<div class="seg">
					<button class:on={sheetDate === 'today'} on:click={() => sheetDate = 'today'}>Today</button>
					<button class:on={sheetDate === 'tomorrow'} on:click={() => sheetDate = 'tomorrow'}>Tomorrow</button>
				</div>
			</div>

			<div class="field-block">
				<span class="lbl">Available time slots</span>
				<div class="slot-grid">
					{#each timeSlots as slot}
						<button
							class="slot"
							class:on={sheetTime === slot}
							disabled={takenSlots.includes(slot)}
							on:click={() => sheetTime = slot}
						>{slot}</button>
					{/each}
				</div>
			</div>

			<div class="qty-row">
				<span class="lbl">Party size</span>
				<div class="qty">
					<button on:click={() => sheetParty = Math.max(1, sheetParty - 1)} disabled={sheetParty <= 1}>−</button>
					<span class="num">{sheetParty}</span>
					<button on:click={() => sheetParty = Math.min(10, sheetParty + 1)} disabled={sheetParty >= 10}>+</button>
				</div>
			</div>

			<textarea class="instructions" bind:value={sheetNote} placeholder="Special instructions (dietary, allergies…)"></textarea>

			<div class="sheet-cta">
				<div class="free-note">No charge · pay at venue</div>
				<button class="btn btn-primary" on:click={submitReservation} disabled={!sheetTime}>
					Reserve table
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.shell { height: 100vh; display: flex; flex-direction: column; background: var(--cream); }
	.main { flex: 1; overflow-y: auto; }

	/* ── Page hero ─────────────────────────────────────────────── */
	.page-hero { padding: 22px 28px 6px; }
	.eyebrow {
		font-size: 11px; letter-spacing: .18em;
		text-transform: uppercase; color: var(--gold-600);
		font-weight: 600; margin-bottom: 6px;
	}
	.page-hero h2 {
		margin: 0 0 6px;
		font-family: var(--font-display);
		font-size: 36px; line-height: 1.05; font-weight: 500;
	}
	.page-hero p { margin: 0; color: var(--ink-3); font-size: 13.5px; line-height: 1.55; }

	/* ── Venue list ────────────────────────────────────────────── */
	.venue-list { padding: 12px 28px 28px; display: flex; flex-direction: column; gap: 14px; }

	.venue-card {
		background: var(--white);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		overflow: hidden;
		box-shadow: var(--sh-1);
	}
	.cover {
		height: 160px; position: relative; overflow: hidden;
		border-bottom: 1px solid var(--line);
		background: var(--cream-2);
	}
	.cover img {
		width: 100%; height: 100%; object-fit: cover; display: block;
	}
	.badges { position: absolute; left: 14px; top: 14px; display: flex; gap: 6px; }
	.pill {
		font: 500 11px/1 var(--font-ui);
		color: var(--ink-2); background: var(--cream-2);
		padding: 5px 9px; border-radius: var(--r-pill);
		display: inline-flex; align-items: center; gap: 5px;
	}
	.pill svg { width: 11px; height: 11px; opacity: .7; }
	.pill.success { background: rgba(31,138,91,.1); color: var(--ok); }
	.pill.warn { background: rgba(196,90,61,.1); color: var(--warn); }

	.body { padding: 14px 16px 16px; }
	.cuisine {
		font: 500 12px/1.4 var(--font-ui);
		color: var(--gold-600); letter-spacing: .04em;
		text-transform: uppercase; margin-bottom: 4px;
	}
	.vname { font: 600 18px/1.25 var(--font-ui); margin: 0 0 2px; }
	.vname .cn { display: block; font-weight: 500; color: var(--ink-2); font-size: 13px; margin-top: 2px; }
	.vmeta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; margin-top: 6px; }
	.vdesc { margin: 0 0 12px; font-size: 13px; color: var(--ink-3); line-height: 1.5; }
	.actions { display: flex; gap: 8px; align-items: center; justify-content: space-between; }

	.btn-ghost {
		background: transparent; border: 1px solid var(--line);
		color: var(--navy-800); border-radius: var(--r-pill);
		padding: 8px 16px; min-height: 36px;
		font: 600 12.5px/1 var(--font-ui); cursor: pointer; transition: all .15s;
	}
	.btn-ghost:hover { border-color: var(--gold-500); color: var(--gold-600); }

	.btn-add {
		background: var(--navy-800); color: #fff; border: none; cursor: pointer;
		border-radius: var(--r-pill);
		padding: 8px 16px; min-height: 36px;
		font: 600 12.5px/1 var(--font-ui);
		display: inline-flex; align-items: center; gap: 6px;
		transition: background .15s, transform .08s;
	}
	.btn-add:hover { background: var(--navy-700); }
	.btn-add:active { transform: scale(.97); }
	.btn-add:disabled { opacity: .4; cursor: not-allowed; }

	/* ── Bottom sheet ──────────────────────────────────────────── */
	.sheet-mask {
		position: fixed; inset: 0;
		background: rgba(15,26,48,.45);
		z-index: 80; opacity: 0; pointer-events: none;
		transition: opacity .25s;
	}
	.sheet-mask.show { opacity: 1; pointer-events: auto; }

	.sheet {
		position: fixed; left: 0; right: 0; bottom: 0;
		background: var(--cream);
		border-radius: 28px 28px 0 0;
		z-index: 81;
		transform: translateY(100%);
		transition: transform .3s cubic-bezier(.2,.8,.2,1);
		max-height: 86%;
		display: flex; flex-direction: column;
		box-shadow: 0 -24px 60px rgba(0,0,0,.25);
	}
	.sheet.show { transform: translateY(0); }

	.grabber {
		width: 40px; height: 4px; border-radius: 2px;
		background: var(--line-2);
		margin: 12px auto 0; flex-shrink: 0;
	}
	.sheet-body { padding: 16px 28px 28px; overflow-y: auto; }

	.big-thumb {
		width: 100%; height: 200px;
		border-radius: var(--r-lg);
		overflow: hidden;
		background: var(--cream-2);
		display: grid; place-items: center;
		font: 500 11px/1.4 var(--font-mono);
		text-align: center;
		border: 1px solid var(--line-2);
		margin-bottom: 20px;
	}
	.big-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.sheet-cuisine {
		color: var(--gold-600);
		font: 500 12px/1.2 var(--font-ui);
		letter-spacing: .06em; text-transform: uppercase;
		margin-bottom: 4px;
	}
	.sheet-body h3 {
		margin: 4px 0 4px;
		font-family: var(--font-display);
		font-size: 28px; font-weight: 500;
	}
	.sheet-desc { color: var(--ink-2); font-size: 14px; line-height: 1.55; margin: 0 0 18px; }

	.field-block { margin-bottom: 16px; }
	.lbl {
		font: 500 11px/1 var(--font-ui);
		letter-spacing: .14em; text-transform: uppercase;
		color: var(--ink-3); margin-bottom: 10px; display: block;
	}

	.seg {
		display: flex; padding: 4px;
		background: var(--cream-2); border-radius: var(--r-pill);
	}
	.seg button {
		flex: 1; border: none; background: transparent;
		padding: 8px 10px; min-height: 36px;
		border-radius: var(--r-pill);
		font: 500 13px/1 var(--font-ui); color: var(--ink-2);
		cursor: pointer; transition: all .15s;
	}
	.seg button.on { background: var(--white); color: var(--navy-800); box-shadow: var(--sh-1); font-weight: 600; }

	.slot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
	.slot {
		border: 1px solid var(--line); background: var(--white);
		border-radius: var(--r-md); padding: 10px 4px;
		font: 500 13px/1 var(--font-ui); color: var(--ink-2);
		cursor: pointer; min-height: 40px; transition: all .15s;
	}
	.slot:hover { border-color: var(--gold-400); }
	.slot.on { background: var(--navy-800); color: #fff; border-color: var(--navy-800); }
	.slot:disabled { color: var(--ink-3); background: var(--cream-2); cursor: not-allowed; text-decoration: line-through; }

	.qty-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 14px 0;
		border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
		margin-bottom: 18px;
	}
	.qty { display: flex; align-items: center; gap: 14px; }
	.qty button {
		width: 44px; height: 44px; border-radius: 50%;
		border: 1px solid var(--line); background: var(--white);
		font: 500 20px/1 var(--font-ui); color: var(--navy-800);
		cursor: pointer; display: grid; place-items: center; transition: all .15s;
	}
	.qty button:hover:not(:disabled) { border-color: var(--gold-500); color: var(--gold-600); }
	.qty button:active { transform: scale(.95); }
	.qty button:disabled { color: var(--ink-3); cursor: not-allowed; }
	.qty .num { font-weight: 600; font-size: 18px; min-width: 28px; text-align: center; }

	.instructions {
		width: 100%;
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-md);
		padding: 14px 16px;
		font: 400 14px/1.5 var(--font-ui); color: var(--ink);
		resize: none; outline: none; min-height: 80px; margin-bottom: 18px;
	}
	.instructions:focus { border-color: var(--gold-400); }

	.sheet-cta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.sheet-cta .btn { flex: 1; }
	.free-note { font-size: 13px; color: var(--ink-3); font-weight: 500; }
</style>
