<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { language } from '$lib/stores/language.js';
	import { cart } from '$lib/stores/cart.js';
	import { roomNumber } from '$lib/stores/room.js';

	// Mock menu data (matches prototype)
	const MENU = [
		{ id: 'nasi', cat: 'Dinner',     name: { en: 'Nasi Goreng', zh: '印尼炒饭' },       desc: { en: 'Indonesian fried rice, fried egg, krupuk, chicken satay.', zh: '印尼经典炒饭，配煎蛋、虾片与鸡肉沙嗲。' }, price: 85000 },
		{ id: 'mie',  cat: 'Dinner',     name: { en: 'Mie Goreng', zh: '印尼炒面' },        desc: { en: 'Wok-fried noodles, shrimp & vegetables, sambal on the side.', zh: '街头风味炒面，鲜虾与时蔬，配辣椒酱。' }, price: 75000 },
		{ id: 'club', cat: 'Lunch',      name: { en: 'Club Sandwich', zh: '俱乐部三明治' }, desc: { en: 'Triple-decker with chicken, bacon, egg, tomato, fries.', zh: '三层吐司：鸡胸、培根、煎蛋、番茄，配薯条。' }, price: 95000 },
		{ id: 'pkx',  cat: 'Breakfast',  name: { en: 'Pancake Stack', zh: '松饼塔' },       desc: { en: 'Buttermilk pancakes, palm sugar syrup, seasonal berries.', zh: '白脱牛奶松饼，棕榈糖浆与时令浆果。' }, price: 65000 },
		{ id: 'fruit',cat: 'Snacks',     name: { en: 'Tropical Fruit Platter', zh: '热带水果拼盘' }, desc: { en: 'Hand-picked mango, papaya, dragonfruit, pineapple.', zh: '芒果、木瓜、火龙果、菠萝精选拼盘。' }, price: 55000 },
		{ id: 'coco', cat: 'Drinks',     name: { en: 'Fresh Coconut Water', zh: '鲜椰青' }, desc: { en: 'Young coconut served whole, chilled on ice.', zh: '整颗鲜椰青，冰镇上桌。' }, price: 35000 },
	];

	const CATS = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];
	const CAT_LABELS: Record<string, { en: string; zh: string }> = {
		All: { en: 'All', zh: '全部' }, Breakfast: { en: 'Breakfast', zh: '早餐' },
		Lunch: { en: 'Lunch', zh: '午餐' }, Dinner: { en: 'Dinner', zh: '晚餐' },
		Snacks: { en: 'Snacks', zh: '小吃' }, Drinks: { en: 'Drinks', zh: '饮品' }
	};

	let activeCat = 'All';
	let sheetItem: typeof MENU[0] | null = null;
	let toastVisible = false;
	let toastText = '';

	$: filtered = activeCat === 'All' ? MENU : MENU.filter(i => i.cat === activeCat);
	$: lang = $language;

	function fmtIDR(n: number) {
		return n.toLocaleString('en-US').replace(/,/g, ' ') + ' IDR';
	}

	function handleAdd(e: CustomEvent<{ item: typeof MENU[0]; quantity: number; specialInstructions: string }>) {
		const { item, quantity, specialInstructions } = e.detail;
		cart.addItem($roomNumber ?? '000', {
			source: 'dining',
			itemId: item.id,
			name: item.name[lang],
			price: item.price,
			quantity,
			specialInstructions
		});
		showToast(`${item.name[lang]} ${lang === 'zh' ? '已加入购物车' : 'added to cart'}`);
	}

	function showToast(msg: string) {
		toastText = msg; toastVisible = true;
		setTimeout(() => { toastVisible = false; }, 2500);
	}

	const T = {
		en: { title: 'In-Room Dining', sub: 'Local favourites & international classics · delivered to your door.' },
		zh: { title: '客房送餐', sub: '本地经典 & 国际美味 · 直送您的房间。' }
	};
	$: t = T[lang];
</script>

<div class="shell">
	<Header />
	<main class="main scroll page-enter">
		<!-- Hero -->
		<div class="dining-hero">
			<h2>{t.title}</h2>
			<p>{t.sub}</p>
		</div>

		<!-- Category chips -->
		<div class="cat-tabs">
			{#each CATS as cat}
				<button class="chip" class:on={activeCat === cat} on:click={() => activeCat = cat}>
					{CAT_LABELS[cat][lang]}
				</button>
			{/each}
		</div>

		<!-- Menu list -->
		<div class="menu-list">
			{#each filtered as item (item.id)}
				<div class="menu-item">
					<div class="thumb">
						<span>{item.name.en}</span>
					</div>
					<div class="info">
						<p class="name">
							{item.name[lang]}
							{#if lang === 'en' && item.name.zh}
								<span class="cn">{item.name.zh}</span>
							{/if}
						</p>
						<p class="desc">{item.desc[lang]}</p>
						<div class="pricerow">
							<span class="price">{fmtIDR(item.price)}</span>
							<button class="btn-add" on:click={() => sheetItem = item}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
									<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
								</svg>
								{lang === 'zh' ? '加入购物车' : 'Add to Cart'}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</main>
	<BottomNav />
</div>

<!-- Bottom sheet -->
<BottomSheet item={sheetItem} open={sheetItem !== null} on:add={handleAdd} on:close={() => sheetItem = null} />

<!-- Toast -->
<div class="toast-wrap">
	<div class="toast" class:show={toastVisible}>
		<span class="chk">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
		</span>
		<span>{toastText}</span>
	</div>
</div>

<style>
	.shell { height: 100vh; display: flex; flex-direction: column; background: var(--cream); }
	.main { flex: 1; overflow-y: auto; }

	.dining-hero { padding: 20px 28px 4px; }
	.dining-hero h2 { margin: 0 0 6px; font-family: var(--font-display); font-size: 34px; line-height: 1.1; font-weight: 500; }
	.dining-hero p { margin: 0; color: var(--ink-3); font-size: 13.5px; }

	.cat-tabs {
		display: flex; gap: 8px;
		padding: 16px 28px 8px;
		overflow-x: auto; scrollbar-width: none;
	}
	.cat-tabs::-webkit-scrollbar { display: none; }
	.chip {
		flex-shrink: 0; border: 1px solid var(--line);
		background: var(--white); border-radius: var(--r-pill);
		padding: 10px 18px; min-height: 40px;
		font: 500 13px/1 var(--font-ui); color: var(--ink-2);
		cursor: pointer; transition: all .15s;
	}
	.chip:hover { border-color: var(--gold-400); }
	.chip.on { background: var(--navy-800); color: #fff; border-color: var(--navy-800); }

	.menu-list { padding: 12px 28px 28px; display: flex; flex-direction: column; gap: 14px; }
	.menu-item {
		display: flex; gap: 16px;
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 14px;
		box-shadow: var(--sh-1); align-items: center;
	}
	.thumb {
		width: 96px; height: 96px; border-radius: var(--r-md); flex-shrink: 0;
		background: repeating-linear-gradient(135deg, var(--cream-2) 0 8px, var(--cream) 8px 16px);
		display: grid; place-items: center; color: var(--ink-3);
		font: 500 9px/1.2 var(--font-mono); text-align: center; padding: 4px;
		border: 1px solid var(--line-2);
	}
	.info { flex: 1; min-width: 0; }
	.name { font: 600 16px/1.25 var(--font-ui); margin: 0 0 2px; color: var(--ink); }
	.cn { font-weight: 500; color: var(--ink-2); font-size: 13px; display: block; margin-top: 2px; }
	.desc {
		margin: 4px 0 8px; font-size: 12.5px; color: var(--ink-3); line-height: 1.45;
		display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
	}
	.pricerow { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.price { font: 600 15px/1 var(--font-ui); color: var(--navy-800); }
	.btn-add {
		background: var(--navy-800); color: #fff;
		border: none; cursor: pointer; border-radius: var(--r-pill);
		padding: 8px 16px; min-height: 36px;
		font: 600 12.5px/1 var(--font-ui);
		display: inline-flex; align-items: center; gap: 6px;
		transition: background .15s, transform .08s;
	}
	.btn-add:hover { background: var(--navy-700); }
	.btn-add:active { transform: scale(.97); }
</style>
