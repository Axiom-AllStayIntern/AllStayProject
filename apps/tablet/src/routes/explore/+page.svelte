<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { language, localize, type LocalizedText } from '$lib/stores/language.js';
	import { formatPrice } from '$lib/utils/format.js';
	import { _ } from 'svelte-i18n';

	interface ExploreItem {
		id: string;
		label: string;
		cover: string;
		imageUrl: string;
		full?: boolean;
		name: LocalizedText;
		description: LocalizedText;
		price: number;
		duration: string;
	}

	const ITEMS: ExploreItem[] = [
		{
			id: 'ex-uluwatu',
			label: 'ULUWATU',
			cover: 'warm',
			imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&auto=format&fit=crop',
			name: { en: 'Uluwatu Cliff Temple', zh: '乌鲁瓦图断崖神庙' },
			description: { en: 'Sunset tour with Kecak fire dance, 4 hours.', zh: '悬崖落日 + Kecak 火舞表演，约 4 小时。' },
			price: 650000,
			duration: '4h'
		},
		{
			id: 'ex-ubud',
			label: 'UBUD',
			cover: 'dark',
			imageUrl: 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=600&auto=format&fit=crop',
			name: { en: 'Ubud Rice Terraces', zh: '乌布梯田' },
			description: { en: 'Tegallalang trek, monkey forest, lunch at organic farm.', zh: 'Tegallalang 步行、圣猴森林、有机农庄午餐。' },
			price: 780000,
			duration: '8h'
		},
		{
			id: 'ex-snorkel',
			label: 'BLUE LAGOON',
			cover: '',
			imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop',
			name: { en: 'Blue Lagoon Snorkel', zh: '蓝色泻湖浮潜' },
			description: { en: 'Boat ride, gear, marine guide.', zh: '船只、装备、专业潜导。' },
			price: 850000,
			duration: '5h'
		},
		{
			id: 'ex-cooking',
			label: 'COOKING',
			cover: '',
			imageUrl: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=600&auto=format&fit=crop',
			name: { en: 'Cooking Class in Canggu', zh: 'Canggu 烹饪课' },
			description: { en: 'Market visit + 6 dishes hands-on.', zh: '市场采购 + 6 道菜亲手制作。' },
			price: 480000,
			duration: '5h'
		},
		{
			id: 'ex-airport',
			label: 'AIRPORT VAN',
			cover: 'warm',
			imageUrl: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&fit=crop',
			full: true,
			name: { en: 'Airport Transfer (Luxury Van)', zh: '机场接送（豪华商务车）' },
			description: { en: 'Door-to-door, English-speaking driver, free bottled water.', zh: '门到门，英文司机，免费瓶装水。' },
			price: 350000,
			duration: '~45 min'
		}
	];

	// ── Bottom sheet state ─────────────────────────────────────
	let sheetItem: ExploreItem | null = null;
	let sheetDate = 'tomorrow';
	let sheetTime = '';
	let sheetPax = 2;
	let sheetNote = '';

	const PICKUP_TIMES = ['06:00','08:00','09:00','10:00','13:00','15:00'];

	function openSheet(item: ExploreItem) {
		sheetItem = item;
		sheetDate = 'tomorrow';
		sheetTime = '';
		sheetPax = 2;
		sheetNote = '';
	}
	function closeSheet() { sheetItem = null; }

	async function submitRequest() {
		if (!sheetItem || !sheetDate || !sheetTime) return;
		// concierge request — fire-and-forget
		closeSheet();
	}

	// Cover gradient map
	const COVER_BG: Record<string, string> = {
		warm: 'repeating-linear-gradient(135deg, #c8a45c 0 10px, #d9bd83 10px 20px)',
		dark: 'repeating-linear-gradient(135deg, #2c5d4f 0 10px, #3a7560 10px 20px)',
		'':   'repeating-linear-gradient(135deg, var(--cream-2) 0 10px, var(--cream) 10px 20px)'
	};
	const COVER_COLOR: Record<string, string> = {
		warm: 'rgba(20,28,50,.55)',
		dark: 'rgba(255,255,255,.6)',
		'':   'var(--ink-3)'
	};
</script>

<div class="shell">
<Header />
<main class="main scroll">
<div class="page-enter">

<!-- ── Page content ─────────────────────────────────────────── -->
<div class="page-hero">
	<div class="eyebrow">{$_('explore.eyebrow')}</div>
	<h2>{$_('explore.title')}</h2>
	<p>{$_('explore.subtitle')}</p>
</div>

<div class="explore-list">
	{#each ITEMS as item}
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
		<div
			class="exp-card"
			class:full={item.full}
			role="button"
			tabindex="0"
			on:click={() => openSheet(item)}
			on:keydown={(e) => e.key === 'Enter' && openSheet(item)}
		>
			<div class="cover">
				<img src={item.imageUrl} alt={item.name.en} loading="lazy" on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
			</div>
			<div class="body">
				<div class="name">{localize(item.name, $language)}</div>
				<div class="desc">{localize(item.description, $language)}</div>
				<div class="pricerow">
					<div>
						<div class="price">{formatPrice(item.price)}<span class="unit">{$_('explore.perPerson')}</span></div>
						<div class="dur">{$_('explore.duration', { values: { duration: item.duration } })}</div>
					</div>
					<div class="arrow">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="5" y1="12" x2="19" y2="12"/>
							<polyline points="12 5 19 12 12 19"/>
						</svg>
					</div>
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
				<img src={sheetItem.imageUrl} alt={sheetItem.name.en} />
			</div>
			<h3>{localize(sheetItem.name, $language)}</h3>
			<p class="sheet-desc">{localize(sheetItem.description, $language)} · <strong>{$_('explore.duration', { values: { duration: sheetItem.duration } })}</strong></p>

			<div class="field-block">
				<span class="lbl">{$_('explore.pickupDate')}</span>
				<div class="seg">
					<button class:on={sheetDate === 'today'} on:click={() => sheetDate = 'today'}>{$_('explore.today')}</button>
					<button class:on={sheetDate === 'tomorrow'} on:click={() => sheetDate = 'tomorrow'}>{$_('explore.tomorrow')}</button>
				</div>
			</div>

			<div class="field-block">
				<span class="lbl">{$_('explore.pickupTime')}</span>
				<div class="slot-grid">
					{#each PICKUP_TIMES as slot}
						<button
							class="slot"
							class:on={sheetTime === slot}
							on:click={() => sheetTime = slot}
						>{slot}</button>
					{/each}
				</div>
			</div>

			<div class="qty-row">
				<span class="lbl">{$_('explore.participants')}</span>
				<div class="qty">
					<button on:click={() => sheetPax = Math.max(1, sheetPax - 1)} disabled={sheetPax <= 1}>−</button>
					<span class="num">{sheetPax}</span>
					<button on:click={() => sheetPax = Math.min(8, sheetPax + 1)} disabled={sheetPax >= 8}>+</button>
				</div>
			</div>

			<textarea class="instructions" bind:value={sheetNote} placeholder={$_('explore.instructions')}></textarea>

			<div class="sheet-cta">
				<div class="total-prev">{formatPrice(sheetItem.price * sheetPax)}</div>
				<button class="btn btn-primary" on:click={submitRequest} disabled={!sheetTime}>
					{$_('explore.request')}
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

	/* ── Explore grid ──────────────────────────────────────────── */
	.explore-list {
		padding: 12px 28px 28px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}

	.exp-card {
		background: var(--white);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
		overflow: hidden;
		box-shadow: var(--sh-1);
		display: flex; flex-direction: column;
		cursor: pointer;
		transition: transform .15s, box-shadow .2s, border-color .15s;
	}
	.exp-card:hover { transform: translateY(-2px); box-shadow: var(--sh-2); border-color: var(--gold-400); }
	.exp-card.full {
		grid-column: 1 / -1;
		flex-direction: row;
	}

	.cover {
		height: 120px;
		overflow: hidden;
		background: var(--cream-2);
		border-bottom: 1px solid var(--line);
		flex-shrink: 0;
	}
	.cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.exp-card.full .cover {
		width: 150px; height: auto;
		border-bottom: none; border-right: 1px solid var(--line);
	}

	.body {
		padding: 12px 14px 14px; flex: 1;
		display: flex; flex-direction: column;
	}
	.name { font: 600 14px/1.3 var(--font-ui); margin: 0 0 4px; }
	.desc {
		font-size: 12px; color: var(--ink-3); line-height: 1.4;
		flex: 1; margin-bottom: 8px;
		display: -webkit-box; line-clamp: 2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
	}
	.pricerow { display: flex; align-items: center; justify-content: space-between; }
	.price { font: 600 13px/1 var(--font-ui); color: var(--navy-800); }
	.unit { font-size: 11px; color: var(--ink-3); font-weight: 500; margin-left: 3px; }
	.dur { font-size: 11px; color: var(--ink-3); margin-top: 3px; }
	.arrow {
		width: 28px; height: 28px; border-radius: 50%;
		background: var(--gold-50); color: var(--gold-600);
		display: grid; place-items: center; flex-shrink: 0;
	}

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
		border: 1px solid var(--line-2);
		margin-bottom: 20px;
	}
	.big-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
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
	.total-prev {
		font-family: var(--font-display);
		font-size: 22px; font-weight: 500; color: var(--navy-800);
	}
</style>
