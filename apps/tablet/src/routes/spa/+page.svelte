<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { language, localize } from '$lib/stores/language.js';
	import { roomNumber } from '$lib/stores/room.js';
	import { formatPrice } from '$lib/utils/format.js';
	import type { PageData } from './$types';
	import { _ } from 'svelte-i18n';

	export let data: PageData;

	// ── Bottom sheet state ─────────────────────────────────────
	let sheetItem: any = null;
	let sheetLocation = 'inRoom';
	let sheetDate: 'today' | 'tomorrow' = 'today';
	let sheetTime = '';
	let sheetGuests = 1;

	// Live availability from the spa MCP (same source the voice pipeline uses).
	let slots: { time: string; isAvailable: boolean }[] = [];
	let slotsLoading = false;

	// today/tomorrow → real YYYY-MM-DD (local), matching the voice booking flow.
	function isoDate(which: 'today' | 'tomorrow'): string {
		const d = new Date();
		if (which === 'tomorrow') d.setDate(d.getDate() + 1);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	async function loadAvailability() {
		if (!sheetItem) return;
		slotsLoading = true;
		slots = [];
		sheetTime = '';
		try {
			const res = await fetch(`/api/spa?serviceId=${encodeURIComponent(sheetItem.id)}&date=${isoDate(sheetDate)}`);
			if (res.ok) {
				const payload = await res.json();
				slots = payload.slots ?? [];
			}
		} catch {
			slots = [];
		} finally {
			slotsLoading = false;
		}
	}

	function openSheet(service: any) {
		sheetItem = service;
		sheetLocation = 'inRoom';
		sheetDate = 'today';
		sheetTime = '';
		sheetGuests = 1;
		loadAvailability();
	}
	function closeSheet() { sheetItem = null; }

	function pickDate(which: 'today' | 'tomorrow') {
		if (sheetDate === which) return;
		sheetDate = which;
		loadAvailability();
	}

	async function submitBooking() {
		if (!sheetItem || !sheetTime) return;
		await fetch(`/api/spa/${sheetItem.id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				// Mirror the voice flow (ai-conversation.ts): never send null — the
				// room store is in-memory and resets on hard reload (persistence is TODO).
				roomId: $roomNumber ?? 'guest',
				date: isoDate(sheetDate),
				time: sheetTime,
				location: sheetLocation,
				guests: sheetGuests
			})
		});
		closeSheet();
	}

	// ── SVG glyphs ─────────────────────────────────────────────
	const GLYPH_PATHS: Record<string, string> = {
		leaf:   '<path d="M11 21c0-9 6-13 11-13-1 7-5 13-11 13zM11 21c-2-3-2-7 0-10"/>',
		stone:  '<ellipse cx="12" cy="16" rx="8" ry="3"/><ellipse cx="10" cy="11" rx="5" ry="2"/><ellipse cx="14" cy="7" rx="3" ry="1.5"/>',
		flower: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 4-6 4-2s-4 4-4 2zM12 14c0 4 4 6 4 2s-4-4-4-2zM10 12c-4 0-6-4-2-4s4 4 2 4zM14 12c4 0 6-4 2-4s-4 4-2 4z"/>',
		foot:   '<path d="M9 22V14a3 3 0 0 1 6 0v8M8 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM14 6a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z"/>',
		hearts: '<path d="M12 19c-5-3-7-7-5-10 1.5-2 4-1 5 1 1-2 3.5-3 5-1 2 3 0 7-5 10z"/>'
	};
</script>

<div class="shell">
<Header />
<main class="main scroll">
<div class="page-enter">

<!-- ── Page content ─────────────────────────────────────────── -->
<div class="page-hero">
	<div class="eyebrow">{$_('spa.eyebrow')}</div>
	<h2>{$_('spa.title')}</h2>
	<p>{$_('spa.subtitle')}</p>
</div>

<div class="spa-list">
	{#if data.services.length === 0}
		<div class="spa-empty">
			{$_('spa.empty')}
		</div>
	{/if}
	{#each data.services as s}
		<div class="spa-card">
			<div class="spa-thumb">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					{@html GLYPH_PATHS[s.glyph] ?? GLYPH_PATHS.leaf}
				</svg>
			</div>
			<div class="info">
				<div class="name">
					{localize(s.name, $language)}
					{#if $language === 'en'}<span class="cn">{s.name.zh}</span>{/if}
				</div>
				<div class="meta">
					<span class="pill">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
						{$_('spa.duration', { values: { min: s.duration } })}
					</span>
					{#if s.isAvailable}
						<span class="pill success">{$_('common.openNow')}</span>
					{:else}
						<span class="pill warn">{$_('common.unavailable')}</span>
					{/if}
				</div>
				<div class="desc">{localize(s.description, $language)}</div>
				<div class="pricerow">
					<div class="price">{formatPrice(s.price)}</div>
					<button class="btn-add" on:click={() => openSheet(s)} disabled={!s.isAvailable}>{$_('spa.bookNow')}</button>
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
			<div class="big-thumb">{localize(sheetItem.name, $language).toUpperCase()}</div>
			<h3>{localize(sheetItem.name, $language)}</h3>
			<p class="sheet-desc">{localize(sheetItem.description, $language)} · <strong>{$_('spa.duration', { values: { min: sheetItem.duration } })}</strong></p>

			<div class="field-block">
				<span class="lbl">{$_('spa.location')}</span>
				<div class="seg">
					<button class:on={sheetLocation === 'inRoom'} on:click={() => sheetLocation = 'inRoom'}>{$_('spa.inRoom')}</button>
					<button class:on={sheetLocation === 'atSpa'} on:click={() => sheetLocation = 'atSpa'}>{$_('spa.atSpa')}</button>
				</div>
			</div>

			<div class="field-block">
				<span class="lbl">{$_('common.date')}</span>
				<div class="seg">
					<button class:on={sheetDate === 'today'} on:click={() => pickDate('today')}>{$_('spa.today')}</button>
					<button class:on={sheetDate === 'tomorrow'} on:click={() => pickDate('tomorrow')}>{$_('spa.tomorrow')}</button>
				</div>
			</div>

			<div class="field-block">
				<span class="lbl">{$_('spa.availableSlots')}</span>
				{#if slotsLoading}
					<div class="slots-note">{$_('spa.loadingSlots')}</div>
				{:else if slots.length === 0}
					<div class="slots-note">{$_('spa.noSlots')}</div>
				{:else}
					<div class="slot-grid">
						{#each slots as slot}
							<button
								class="slot"
								class:on={sheetTime === slot.time}
								disabled={!slot.isAvailable}
								on:click={() => sheetTime = slot.time}
							>{slot.time}</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="qty-row">
				<span class="lbl">{$_('spa.guests')}</span>
				<div class="qty">
					<button on:click={() => sheetGuests = Math.max(1, sheetGuests - 1)} disabled={sheetGuests <= 1}>−</button>
					<span class="num">{sheetGuests}</span>
					<button on:click={() => sheetGuests = Math.min(4, sheetGuests + 1)} disabled={sheetGuests >= 4}>+</button>
				</div>
			</div>

			<div class="sheet-cta">
				<div class="total-prev">{formatPrice(sheetItem.price * sheetGuests)}</div>
				<button class="btn btn-primary" on:click={submitBooking} disabled={!sheetTime}>
					{$_('spa.bookTreatment')}
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

	/* ── Spa list ──────────────────────────────────────────────── */
	.spa-list { padding: 12px 28px 28px; display: flex; flex-direction: column; gap: 14px; }

	.spa-card {
		background: var(--white);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		padding: 16px;
		box-shadow: var(--sh-1);
		display: flex; gap: 14px;
	}
	.spa-thumb {
		width: 96px; height: 96px; flex-shrink: 0;
		border-radius: var(--r-md);
		overflow: hidden;
		background:
			repeating-linear-gradient(135deg, rgba(200,164,92,.18) 0 6px, rgba(200,164,92,.06) 6px 12px),
			var(--gold-50);
		display: grid; place-items: center;
		color: var(--gold-600);
		border: 1px solid rgba(200,164,92,.25);
	}
	.spa-thumb svg { width: 32px; height: 32px; }

	.info { flex: 1; min-width: 0; }
	.name { font: 600 16px/1.25 var(--font-ui); margin: 0 0 4px; color: var(--ink); }
	.name .cn { display: block; font-weight: 500; color: var(--ink-2); font-size: 13px; margin-top: 2px; }

	.meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
	.pill {
		font: 500 11px/1 var(--font-ui);
		color: var(--ink-2); background: var(--cream-2);
		padding: 5px 9px; border-radius: var(--r-pill);
		display: inline-flex; align-items: center; gap: 5px;
	}
	.pill svg { width: 11px; height: 11px; opacity: .7; }
	.pill.success { background: rgba(31,138,91,.1); color: var(--ok); }
	.pill.warn { background: rgba(196,90,61,.1); color: var(--warn); }

	.desc {
		margin: 4px 0 10px;
		font-size: 12.5px; color: var(--ink-3); line-height: 1.45;
		display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
	}
	.pricerow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.price { font: 600 15px/1 var(--font-ui); color: var(--navy-800); }

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
	.sheet-body {
		padding: 16px 28px 28px;
		overflow-y: auto;
	}

	.big-thumb {
		width: 100%; height: 200px;
		border-radius: var(--r-lg);
		background: repeating-linear-gradient(135deg, var(--cream-2) 0 12px, var(--cream) 12px 24px);
		display: grid; place-items: center;
		color: var(--ink-3);
		font: 500 11px/1.4 var(--font-mono);
		text-align: center;
		border: 1px solid var(--line-2);
		margin-bottom: 20px;
	}
	.sheet-body h3 {
		margin: 4px 0 4px;
		font-family: var(--font-display);
		font-size: 28px; font-weight: 500;
	}
	.sheet-desc { color: var(--ink-2); font-size: 14px; line-height: 1.55; margin: 0 0 18px; }

	.field-block { margin-bottom: 16px; }
	.field-block .lbl, .qty-row .lbl {
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
	.seg button.on {
		background: var(--white); color: var(--navy-800);
		box-shadow: var(--sh-1); font-weight: 600;
	}

	.slots-note {
		font: 500 13px/1.4 var(--font-ui); color: var(--ink-3);
		padding: 10px 0 18px;
	}
	.spa-empty {
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 28px 20px;
		text-align: center; color: var(--ink-3);
		font: 500 13.5px/1.5 var(--font-ui);
	}
	.slot-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
	.slot {
		border: 1px solid var(--line); background: var(--white);
		border-radius: var(--r-md);
		padding: 10px 4px;
		font: 500 13px/1 var(--font-ui); color: var(--ink-2);
		cursor: pointer; min-height: 40px; transition: all .15s;
	}
	.slot:hover { border-color: var(--gold-400); }
	.slot.on { background: var(--navy-800); color: #fff; border-color: var(--navy-800); }
	.slot:disabled {
		color: var(--ink-3); background: var(--cream-2); cursor: not-allowed;
		text-decoration: line-through; text-decoration-color: var(--ink-3);
	}

	.qty-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 14px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		margin-bottom: 18px;
	}
	.qty { display: flex; align-items: center; gap: 14px; }
	.qty button {
		width: 44px; height: 44px; border-radius: 50%;
		border: 1px solid var(--line); background: var(--white);
		font: 500 20px/1 var(--font-ui); color: var(--navy-800);
		cursor: pointer; display: grid; place-items: center;
		transition: all .15s;
	}
	.qty button:hover:not(:disabled) { border-color: var(--gold-500); color: var(--gold-600); }
	.qty button:active { transform: scale(.95); }
	.qty button:disabled { color: var(--ink-3); cursor: not-allowed; }
	.qty .num { font-weight: 600; font-size: 18px; min-width: 28px; text-align: center; }

	.sheet-cta {
		display: flex; align-items: center; justify-content: space-between; gap: 12px;
	}
	.sheet-cta .btn { flex: 1; }
	.total-prev {
		font-family: var(--font-display);
		font-size: 22px; font-weight: 500; color: var(--navy-800);
	}
</style>
