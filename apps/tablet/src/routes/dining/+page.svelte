<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import BottomSheet from '$lib/components/BottomSheet.svelte';
	import { language, localize, type LocalizedText } from '$lib/stores/language.js';
	import { cart } from '$lib/stores/cart.js';
	import { roomNumber } from '$lib/stores/room.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	interface MenuItem {
		id: string;
		cat: string;
		tags: string[];
		name: LocalizedText;
		desc: LocalizedText;
		price: number;
		discount?: number;   // e.g. 0.8 = 80% of original (20% off / 8折)
		imageUrl?: string;
		promo?: { badge: LocalizedText; tagline: LocalizedText };
	}

	const MENU: MenuItem[] = [
		// ── Noodles ──────────────────────────────────────────────────────────────
		{
			id: 'mie-aceh', cat: 'Dinner', tags: ['noodles', 'indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Mie Aceh', zh: '亚齐香料面' },
			desc: {
				en: 'Thick egg noodles in rich Acehnese curry broth, tiger prawns, squid, cardamom & star anise.',
				zh: '粗蛋面浸于亚齐浓郁咖喱汤，大虎虾与鱿鱼，豆蔻与八角。'
			},
			price: 115000,
			discount: 0.8,
			promo: {
				badge:   { en: 'New Arrival', zh: '新品上市' },
				tagline: { en: 'A rare Sumatran classic — inspired by Aceh\'s ancient spice trade heritage.', zh: '源自苏门答腊的亚齐古法香料面，传承百年丝路滋味。' }
			}
		},
		{
			id: 'mie', cat: 'Dinner', tags: ['noodles', 'indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Mie Goreng', zh: '印尼炒面' },
			desc: { en: 'Wok-fried noodles, shrimp & vegetables, sambal on the side.', zh: '街头风味炒面，鲜虾与时蔬，配辣椒酱。' },
			price: 75000
		},
		{
			id: 'bakmi', cat: 'Dinner', tags: ['noodles', 'indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Bakmi Ayam', zh: '爪哇鸡肉面' },
			desc: { en: 'Javanese egg noodles, braised chicken thigh, shiitake, bok choy, crispy wontons.', zh: '爪哇蛋面，卤鸡腿、香菇、小白菜与脆云吞。' },
			price: 88000
		},

		// ── Rice ─────────────────────────────────────────────────────────────────
		{
			id: 'nasi', cat: 'Dinner', tags: ['rice', 'indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Nasi Goreng', zh: '印尼炒饭' },
			desc: { en: 'Indonesian fried rice, fried egg, krupuk, chicken satay.', zh: '印尼经典炒饭，配煎蛋、虾片与鸡肉沙嗲。' },
			price: 85000,
			promo: {
				badge:   { en: "Chef's Pick", zh: '主厨推荐' },
				tagline: { en: "Our #1 most-ordered dish — a Bali classic you can't miss.", zh: '全场最受欢迎 · 巴厘岛必吃经典，每日鲜制。' }
			}
		},
		{
			id: 'nasi-campur', cat: 'Dinner', tags: ['rice', 'indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Nasi Campur Bali', zh: '巴厘混合饭' },
			desc: { en: 'Steamed rice, Balinese spiced chicken, tempeh, lawar & sambal matah.', zh: '香米饭配巴厘香料鸡、天贝、腌菜与生辣椒莎莎。' },
			price: 105000
		},
		{
			id: 'nasi-uduk', cat: 'Dinner', tags: ['rice', 'indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Nasi Uduk', zh: '椰香米饭套餐' },
			desc: { en: 'Fragrant coconut rice, fried chicken, tempeh, cucumber & peanut sauce.', zh: '椰浆香米饭，炸鸡腿、天贝、黄瓜与花生酱。' },
			price: 90000
		},

		// ── Breakfast ────────────────────────────────────────────────────────────
		{
			id: 'pkx', cat: 'Breakfast', tags: ['sweet', 'western'],
			imageUrl: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Pancake Stack', zh: '松饼塔' },
			desc: { en: 'Buttermilk pancakes, palm sugar syrup, seasonal berries.', zh: '白脱牛奶松饼，棕榈糖浆与时令浆果。' },
			price: 65000
		},
		{
			id: 'eggs-bene', cat: 'Breakfast', tags: ['western', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Eggs Benedict', zh: '班尼迪克蛋' },
			desc: { en: 'Poached eggs, smoked beef, hollandaise on toasted brioche.', zh: '水波蛋、烟熏牛肉与荷兰酱，搭配布里欧修烤面包。' },
			price: 95000
		},
		{
			id: 'bubur', cat: 'Breakfast', tags: ['rice', 'indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Bubur Ayam', zh: '鸡肉粥' },
			desc: { en: 'Indonesian chicken congee, fried shallots, crispy crackers, ginger broth.', zh: '印尼鸡肉白粥，炸葱酥、脆饼干与姜汁高汤。' },
			price: 55000
		},

		// ── Lunch ────────────────────────────────────────────────────────────────
		{
			id: 'club', cat: 'Lunch', tags: ['sandwich', 'western'],
			imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Club Sandwich', zh: '俱乐部三明治' },
			desc: { en: 'Triple-decker with chicken, bacon, egg, tomato, fries.', zh: '三层吐司：鸡胸、培根、煎蛋、番茄，配薯条。' },
			price: 95000
		},
		{
			id: 'gado-gado', cat: 'Lunch', tags: ['healthy', 'vegan', 'indonesian'],
			imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Gado-Gado', zh: '花生酱蔬菜沙拉' },
			desc: { en: 'Blanched vegetables, tofu, tempeh, boiled egg, peanut sauce, krupuk.', zh: '焯水时蔬、豆腐、天贝与花生酱，配印尼虾片。' },
			price: 75000
		},
		{
			id: 'satay', cat: 'Lunch', tags: ['indonesian', 'savory'],
			imageUrl: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Chicken Satay', zh: '鸡肉沙嗲串' },
			desc: { en: 'Charcoal-grilled chicken skewers, peanut sauce, lontong rice cake, pickles.', zh: '炭火鸡肉串，配花生酱、压缩糯米与泡菜。' },
			price: 85000
		},

		// ── Snacks ───────────────────────────────────────────────────────────────
		{
			id: 'fruit', cat: 'Snacks', tags: ['fruit', 'healthy', 'vegan'],
			imageUrl: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Tropical Fruit Platter', zh: '热带水果拼盘' },
			desc: { en: 'Hand-picked mango, papaya, dragonfruit, pineapple.', zh: '芒果、木瓜、火龙果、菠萝精选拼盘。' },
			price: 55000
		},
		{
			id: 'pisang', cat: 'Snacks', tags: ['sweet', 'indonesian'],
			imageUrl: 'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Pisang Goreng', zh: '印尼香蕉糕' },
			desc: { en: 'Crispy fried banana fritters, palm sugar dip, vanilla ice cream.', zh: '酥炸香蕉，配棕榈糖酱与香草冰淇淋。' },
			price: 45000
		},
		{
			id: 'tempe', cat: 'Snacks', tags: ['indonesian', 'healthy', 'vegan'],
			imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Tempe Mendoan', zh: '印尼炸天贝' },
			desc: { en: 'Lightly battered tempeh fritters, sweet soy & chilli dipping sauce.', zh: '轻裹面糊炸天贝，配甜酱油辣椒蘸酱。' },
			price: 40000
		},

		// ── Drinks ───────────────────────────────────────────────────────────────
		{
			id: 'coco', cat: 'Drinks', tags: ['drinks', 'vegan'],
			imageUrl: 'https://images.unsplash.com/photo-1580968560620-d3d07d20c8a5?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Fresh Coconut Water', zh: '鲜椰青' },
			desc: { en: 'Young coconut served whole, chilled on ice.', zh: '整颗鲜椰青，冰镇上桌。' },
			price: 35000
		},
		{
			id: 'jamu', cat: 'Drinks', tags: ['drinks', 'healthy', 'indonesian'],
			imageUrl: 'https://images.unsplash.com/photo-1622597467836-f3e5e5e5c498?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Jamu Herbal Drink', zh: '传统草本饮' },
			desc: { en: 'Traditional Balinese jamu: turmeric, ginger, tamarind, honey. Warm or iced.', zh: '巴厘传统草本：姜黄、生姜、罗望子与蜂蜜，可冷可热。' },
			price: 45000
		},
		{
			id: 'alpukat', cat: 'Drinks', tags: ['drinks', 'sweet'],
			imageUrl: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&q=80&auto=format&fit=crop',
			name: { en: 'Es Alpukat', zh: '巴厘牛油果奶昔' },
			desc: { en: 'Balinese avocado shake, condensed milk, palm sugar, shaved ice.', zh: '巴厘经典牛油果奶昔，炼乳、棕榈糖与刨冰。' },
			price: 55000
		},
	];

	const CATS = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];
	const CAT_LABELS: Record<string, LocalizedText> = {
		All: { en: 'All', zh: '全部' }, Breakfast: { en: 'Breakfast', zh: '早餐' },
		Lunch: { en: 'Lunch', zh: '午餐' }, Dinner: { en: 'Dinner', zh: '晚餐' },
		Snacks: { en: 'Snacks', zh: '小吃' }, Drinks: { en: 'Drinks', zh: '饮品' }
	};
	const TAG_LABELS: Record<string, LocalizedText> = {
		noodles:  { en: 'Noodles',  zh: '面食' },
		rice:     { en: 'Rice',     zh: '米饭' },
		sandwich: { en: 'Sandwich', zh: '三明治' },
		sweet:    { en: 'Sweet',    zh: '甜点' },
		fruit:    { en: 'Fruit',    zh: '水果' },
		drinks:   { en: 'Drinks',   zh: '饮品' },
		healthy:  { en: 'Healthy',  zh: '健康' },
	};

	let activeCat = 'All';
	let sheetItem: MenuItem | null = null;
	let toastVisible = false;
	let toastText = '';

	$: activeTag   = $page.url.searchParams.get('tag') ?? '';
	$: recommendId = $page.url.searchParams.get('recommend') ?? '';

	$: filtered = (() => {
		const base = MENU.filter(item => {
			const catMatch = activeCat === 'All' || item.cat === activeCat;
			const tagMatch = !activeTag || item.tags.includes(activeTag);
			return catMatch && tagMatch;
		});
		if (!recommendId) return base;
		const idx = base.findIndex(i => i.id === recommendId);
		if (idx <= 0) return base;
		return [base[idx], ...base.slice(0, idx), ...base.slice(idx + 1)];
	})();

	$: lang = $language;

	function clearTagFilter() {
		goto('/dining', { replaceState: true });
	}

	function fmtIDR(n: number) {
		return n.toLocaleString('en-US').replace(/,/g, ' ') + ' IDR';
	}

	function salePrice(item: { price: number; discount?: number }): number {
		return item.discount ? Math.round(item.price * item.discount) : item.price;
	}

	function discountLabel(item: MenuItem): string {
		if (!item.discount) return '';
		const pct = Math.round(item.discount * 10);
		return lang === 'zh' ? `${pct}折` : `${Math.round((1 - item.discount) * 100)}% OFF`;
	}

	function handleAdd(e: CustomEvent<{ item: { id: string; name: LocalizedText; price: number; discount?: number }; quantity: number; specialInstructions: string }>) {
		const { item, quantity, specialInstructions } = e.detail;
		cart.addItem($roomNumber ?? '000', {
			source: 'dining',
			itemId: item.id,
			name: localize(item.name, lang),
			price: salePrice(item),
			quantity,
			specialInstructions
		});
		showToast(`${localize(item.name, lang)} ${lang === 'zh' ? '已加入购物车' : lang === 'id' ? 'ditambahkan ke keranjang' : 'added to cart'}`);
	}

	function showToast(msg: string) {
		toastText = msg; toastVisible = true;
		setTimeout(() => { toastVisible = false; }, 2500);
	}

	const T = {
		en: { title: 'In-Room Dining', sub: 'Local favourites & international classics · delivered to your door.' },
		zh: { title: '客房送餐', sub: '本地经典 & 国际美味 · 直送您的房间。' },
		id: { title: 'Santapan di Kamar', sub: 'Hidangan lokal dan internasional · diantar ke kamar Anda.' }
	};
	$: t = T[lang];
</script>

<div class="shell">
	<Header />
	<main class="main scroll page-enter">
		<div class="dining-hero">
			<h2>{t.title}</h2>
			<p>{t.sub}</p>
		</div>

		<div class="cat-tabs">
			{#each CATS as cat}
				<button class="chip" class:on={activeCat === cat} on:click={() => activeCat = cat}>
					{localize(CAT_LABELS[cat], lang)}
				</button>
			{/each}
		</div>

		{#if activeTag && TAG_LABELS[activeTag]}
			<div class="tag-banner">
				<span class="tag-icon">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
						<line x1="7" y1="7" x2="7.01" y2="7"/>
					</svg>
				</span>
				<span>
					{lang === 'zh' ? '筛选：' : 'Filtered: '}
					<strong>{localize(TAG_LABELS[activeTag], lang)}</strong>
				</span>
				<button class="tag-clear" on:click={clearTagFilter} aria-label="Clear filter">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		{/if}

		<div class="menu-list">
			{#each filtered as item, idx (item.id)}
				{#if item.id === recommendId}
					<!-- ── Featured card (AI recommendation only) ───────────────────── -->
					<div class="featured-card">
						<!-- badges row above the card body -->
						<div class="featured-badges">
							<span class="featured-rec-badge">
								<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
								{lang === 'zh' ? '为您推荐' : 'Recommended for you'}
							</span>
							{#if item.promo}
								<span class="featured-promo-badge">{localize(item.promo.badge, lang)}</span>
							{/if}
							{#if item.discount}
								<span class="featured-discount-badge">{discountLabel(item)}</span>
							{/if}
						</div>

						<!-- horizontal body: image left, info right -->
						<div class="featured-body">
							<div class="featured-thumb">
								{#if item.imageUrl}
									<img
										src={item.imageUrl}
										alt={item.name.en}
										loading="lazy"
										on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
									/>
								{/if}
							</div>
							<div class="featured-info">
								<p class="featured-name">{localize(item.name, lang)}</p>
								{#if lang === 'en' && item.name.zh}
									<span class="featured-cn">{item.name.zh}</span>
								{/if}
								{#if item.promo}
									<p class="featured-tagline">{localize(item.promo.tagline, lang)}</p>
								{/if}
								<p class="featured-desc">{localize(item.desc, lang)}</p>
								<div class="featured-footer">
									<div class="featured-price-block">
										<span class="featured-price">{fmtIDR(salePrice(item))}</span>
										{#if item.discount}
											<span class="featured-orig-price">{fmtIDR(item.price)}</span>
										{/if}
									</div>
									<button class="btn-add btn-add-lg" on:click={() => sheetItem = item}>
										<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
											<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
										</svg>
										{lang === 'zh' ? '加入购物车' : 'Add to Cart'}
									</button>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<!-- ── Regular card ──────────────────────────────────────────────── -->
					<div class="menu-item" class:has-promo={!!item.promo}>
						{#if item.promo}
							<div class="promo-bar">
								<span class="promo-badge">{localize(item.promo.badge, lang)}</span>
								<span class="promo-tagline">{localize(item.promo.tagline, lang)}</span>
							</div>
						{/if}

						<div class="item-body">
							<div class="thumb">
								{#if item.imageUrl}
									<img
										src={item.imageUrl}
										alt={item.name.en}
										loading="lazy"
										on:error={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
									/>
								{:else}
									<span>{item.name.en}</span>
								{/if}
							</div>
							<div class="info">
								<p class="name">
									{localize(item.name, lang)}
									{#if lang === 'en' && item.name.zh}
										<span class="cn">{item.name.zh}</span>
									{/if}
								</p>
								<p class="desc">{localize(item.desc, lang)}</p>
								<div class="pricerow">
									<div class="price-block">
										<span class="price">{fmtIDR(salePrice(item))}</span>
										{#if item.discount}
											<span class="orig-price">{fmtIDR(item.price)}</span>
											<span class="discount-tag">{discountLabel(item)}</span>
										{/if}
									</div>
									<button class="btn-add" on:click={() => sheetItem = item}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
											<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
										</svg>
										{lang === 'zh' ? '加入购物车' : 'Add to Cart'}
									</button>
								</div>
							</div>
						</div>
					</div>
				{/if}
			{/each}

			{#if filtered.length === 0}
				<p class="empty">
					{lang === 'zh' ? '暂无相关菜品' : 'No items match this filter.'}
				</p>
			{/if}
		</div>
	</main>
	<BottomNav />
</div>

<BottomSheet item={sheetItem} open={sheetItem !== null} on:add={handleAdd} on:close={() => sheetItem = null} />

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

	.tag-banner {
		display: flex; align-items: center; gap: 8px;
		margin: 4px 28px 0;
		padding: 9px 14px;
		background: #e8f0fe; border: 1px solid #c5d5f5;
		border-radius: var(--r-md);
		font-size: 13px; color: #1a3a8f;
	}
	.tag-icon { display: flex; align-items: center; opacity: 0.7; }
	.tag-banner strong { font-weight: 600; }
	.tag-clear {
		margin-left: auto; background: none; border: none; cursor: pointer;
		color: #1a3a8f; opacity: 0.6; padding: 2px; display: flex; align-items: center;
	}
	.tag-clear:hover { opacity: 1; }

	.menu-list { padding: 12px 28px 28px; display: flex; flex-direction: column; gap: 14px; }
	.menu-item {
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-lg); box-shadow: var(--sh-1); overflow: hidden;
	}

	/* ── Featured card (AI recommendation, horizontal layout) ───────────────── */
	.featured-card {
		background: var(--white); border: 1.5px solid #0e7a6e;
		border-radius: var(--r-lg);
		box-shadow: 0 0 0 3px rgba(14,122,110,0.10), 0 6px 24px rgba(0,0,0,0.09);
		overflow: hidden;
	}
	.featured-badges {
		display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
		padding: 10px 14px 0;
	}
	.featured-rec-badge {
		display: inline-flex; align-items: center; gap: 5px;
		background: #0e7a6e; color: #fff;
		padding: 5px 11px; border-radius: var(--r-pill);
		font: 700 11.5px/1 var(--font-ui); letter-spacing: 0.03em;
	}
	.featured-promo-badge {
		background: linear-gradient(90deg,#7c5c1e,#b8892a); color: #fff;
		padding: 5px 11px; border-radius: var(--r-pill);
		font: 700 11px/1 var(--font-ui); letter-spacing: 0.04em; text-transform: uppercase;
	}
	.featured-discount-badge {
		background: #d92b2b; color: #fff;
		padding: 5px 11px; border-radius: var(--r-pill);
		font: 800 12px/1 var(--font-ui); letter-spacing: 0.04em;
	}
	.featured-body {
		display: flex; gap: 16px; padding: 12px 14px 16px; align-items: flex-start;
	}
	.featured-thumb {
		flex-shrink: 0; width: 140px; height: 140px;
		border-radius: var(--r-md); overflow: hidden;
		background: repeating-linear-gradient(135deg, var(--cream-2) 0 10px, var(--cream) 10px 20px);
		border: 1px solid var(--line-2);
	}
	.featured-thumb img {
		width: 100%; height: 100%; object-fit: cover; display: block;
	}
	.featured-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
	.featured-name { margin: 0; font: 700 19px/1.25 var(--font-display); color: var(--ink); }
	.featured-cn { font: 500 13px/1 var(--font-ui); color: var(--ink-3); }
	.featured-tagline {
		margin: 0; font: 500 italic 12.5px/1.4 var(--font-ui); color: #0e7a6e;
	}
	.featured-desc {
		margin: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.45;
		display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
	}
	.featured-footer {
		display: flex; align-items: center; justify-content: space-between;
		gap: 10px; margin-top: auto; padding-top: 8px;
	}
	.featured-price-block { display: flex; align-items: baseline; gap: 7px; }
	.featured-price { font: 700 18px/1 var(--font-ui); color: #d92b2b; }
	.featured-orig-price {
		font: 400 12px/1 var(--font-ui); color: var(--ink-3);
		text-decoration: line-through;
	}
	.btn-add-lg { padding: 9px 18px; min-height: 38px; font-size: 13px; }

	/* ── Regular card discount ───────────────────────────────────────────────── */
	.price-block { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
	.orig-price {
		font: 400 12px/1 var(--font-ui); color: var(--ink-3);
		text-decoration: line-through;
	}
	.discount-tag {
		font: 700 11px/1 var(--font-ui); color: #d92b2b;
		background: #fff0f0; border: 1px solid #f9c2c2;
		border-radius: 4px; padding: 1px 5px;
	}

	.promo-bar {
		display: flex; align-items: center; gap: 10px;
		padding: 8px 14px;
		background: linear-gradient(90deg, #7c5c1e 0%, #b8892a 100%);
		color: #fff;
	}
	.promo-badge {
		flex-shrink: 0;
		background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.4);
		border-radius: 20px; padding: 3px 10px;
		font: 700 11px/1 var(--font-ui); letter-spacing: 0.03em; text-transform: uppercase;
	}
	.promo-tagline { font-size: 12px; line-height: 1.35; opacity: 0.92; }

	.item-body { display: flex; gap: 16px; padding: 14px; align-items: center; }
	.thumb {
		width: 96px; height: 96px; border-radius: var(--r-md); flex-shrink: 0;
		background: repeating-linear-gradient(135deg, var(--cream-2) 0 8px, var(--cream) 8px 16px);
		display: grid; place-items: center; color: var(--ink-3);
		font: 500 9px/1.2 var(--font-mono); text-align: center; padding: 4px;
		border: 1px solid var(--line-2); overflow: hidden;
	}
	.thumb img {
		width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block;
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
	.price-block .price { color: #d92b2b; }
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

	.empty { text-align: center; color: var(--ink-3); font-size: 14px; padding: 32px 0; }

	.toast-wrap { position: fixed; bottom: 88px; left: 0; right: 0; display: flex; justify-content: center; pointer-events: none; z-index: 300; }
	.toast {
		display: inline-flex; align-items: center; gap: 10px;
		background: var(--navy-800); color: #fff;
		padding: 12px 20px; border-radius: var(--r-pill);
		font: 500 14px/1 var(--font-ui);
		opacity: 0; transform: translateY(8px);
		transition: opacity .25s, transform .25s; pointer-events: none;
	}
	.toast.show { opacity: 1; transform: translateY(0); }
	.chk { width: 18px; height: 18px; flex-shrink: 0; }
	.chk svg { width: 100%; height: 100%; }
</style>
