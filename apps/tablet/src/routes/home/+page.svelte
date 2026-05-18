<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import VoiceButton from '$lib/components/VoiceButton.svelte';
	import { roomNumber } from '$lib/stores/room.js';
	import { language } from '$lib/stores/language.js';
	import { goto } from '$app/navigation';
	import { addToast } from '$lib/stores/toast.js';
	import type { AIResponse } from '$lib/services/ai-conversation.js';

	async function handleVoiceResult(response: AIResponse) {
		if (response.text) {
			addToast({ message: response.text, type: response.action ? 'info' : 'error', duration: 5000 });
		}
		if (response.action?.type === 'navigate') {
			await goto(response.action.payload.route);
		}
	}

	const T = {
		en: {
			howCanWe: 'How can we help today?', services: 'Services',
			dining: 'In-Room Dining', diningDesc: '24/7 menu · 20–40 min',
			spa: 'Spa & Wellness', spaDesc: 'Treatments · 9:00–22:00',
			restaurants: 'Hotel Restaurants', restaurantsDesc: '3 venues · Reserve a table',
			amenities: 'Amenities', amenitiesDesc: 'Pool, gym, laundry & more',
			explore: 'Explore Bali', exploreDesc: 'Tours, transport & tips',
			cart: 'My Cart', cartEmptyLine: 'No items yet',
			conciergeTitle: 'Need anything? Concierge is one tap away.',
			conciergeSub: 'Ari, your butler today · responds in < 2 minutes',
			chat: 'Chat',
			greetMorning: 'Good Morning', greetAfternoon: 'Good Afternoon', greetEvening: 'Good Evening',
			guest: 'Guest', weather: 'Sunny · 29°C', checkout: 'Check-out 12:00'
		},
		zh: {
			howCanWe: '今天我们能为您做些什么？', services: '服务',
			dining: '客房送餐', diningDesc: '24小时菜单 · 20–40 分钟',
			spa: '水疗与康体', spaDesc: '理疗 · 9:00–22:00',
			restaurants: '酒店餐厅', restaurantsDesc: '3 家餐厅 · 预约餐位',
			amenities: '设施', amenitiesDesc: '泳池、健身房、洗衣等',
			explore: '探索巴厘', exploreDesc: '行程、用车与攻略',
			cart: '我的购物车', cartEmptyLine: '购物车暂无商品',
			conciergeTitle: '需要协助？礼宾随时为您服务。',
			conciergeSub: '今日管家 Ari · 2 分钟内回复',
			chat: '对话',
			greetMorning: '早上好', greetAfternoon: '下午好', greetEvening: '晚上好',
			guest: '贵宾', weather: '晴 · 29°C', checkout: '退房 12:00'
		}
	} as const;

	$: t = T[$language];

	$: greeting = (() => {
		const h = new Date().getHours();
		return h < 12 ? t.greetMorning : h < 18 ? t.greetAfternoon : t.greetEvening;
	})();

	$: dateStr = new Date().toLocaleDateString($language === 'zh' ? 'zh-CN' : 'en-GB', {
		weekday: 'long', day: 'numeric', month: 'long'
	});

	const CARDS = [
		{ path: '/dining', key: 'dining', descKey: 'diningDesc', dark: false,
		  icon: `<path d="M4 3v18M4 12h6c1 0 2-1 2-2V4M18 3v8a3 3 0 0 1-3 3v7M15 14h3"/>` },
		{ path: '/spa', key: 'spa', descKey: 'spaDesc', dark: false,
		  icon: `<path d="M12 2c2 4-2 4 0 8s-2 4 0 8M5 8c2 4-2 4 0 8M19 8c2 4-2 4 0 8"/>` },
		{ path: '/restaurants', key: 'restaurants', descKey: 'restaurantsDesc', dark: false,
		  icon: `<path d="M8 21h8M12 21V9M6 4l1 5h10l1-5M5 4h14"/>` },
		{ path: '/amenities', key: 'amenities', descKey: 'amenitiesDesc', dark: false,
		  icon: `<path d="M2 18h20M4 18V8a2 2 0 0 1 2-2h2M20 18V8a2 2 0 0 0-2-2h-2M9 6V4h6v2"/>` },
		{ path: '/explore', key: 'explore', descKey: 'exploreDesc', dark: true,
		  icon: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>` },
		{ path: '/cart', key: 'cart', descKey: 'cartEmptyLine', dark: false,
		  icon: `<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>` }
	] as const;
</script>

<div class="shell">
	<Header />
	<main class="main scroll">
		<div class="page-enter">
			<!-- Greeting -->
			<div class="welcome-wrap">
				<h1 class="greeting">{greeting}, <span class="accent">{t.guest}</span></h1>
				<div class="greeting-meta">
					<span>{dateStr}</span>
					<span class="sep"></span>
					<span>{t.weather}</span>
					<span class="sep"></span>
					<span>{t.checkout}</span>
				</div>
			</div>

			<!-- Section header -->
			<div class="section-title">
				<h3>{t.howCanWe}</h3>
				<span class="eyebrow">{t.services}</span>
			</div>

			<!-- Quick grid -->
			<div class="quickgrid">
				{#each CARDS as card}
					<button class="qcard" class:dark={card.dark} on:click={() => goto(card.path)}>
						<div>
							<div class="glyph">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
									{@html card.icon}
								</svg>
							</div>
							<div class="qtitle">{t[card.key]}</div>
							<div class="qdesc">{t[card.descKey]}</div>
						</div>
					</button>
				{/each}
			</div>

			<!-- Concierge banner -->
			<div class="concierge-banner">
				<div class="pic">PHOTO</div>
				<div class="ctxt">
					<h4>{t.conciergeTitle}</h4>
					<p>{t.conciergeSub}</p>
				</div>
				<button class="btn btn-primary" style="min-height:44px; padding: 0 18px; font-size: 13px;">
					{t.chat}
				</button>
			</div>
		</div>
	</main>
	<BottomNav />
	<VoiceButton onResult={handleVoiceResult} />
</div>

<style>
	.shell { height: 100vh; display: flex; flex-direction: column; background: var(--cream); }
	.main { flex: 1; overflow-y: auto; }

	.welcome-wrap { padding: 20px 28px 0; }
	.greeting {
		font-family: var(--font-display);
		font-size: 36px; line-height: 1.1;
		margin: 0 0 6px; font-weight: 500;
	}
	.accent { color: var(--gold-600); font-style: italic; }
	.greeting-meta {
		color: var(--ink-3); font-size: 13px;
		display: flex; align-items: center; gap: 10px;
		margin-bottom: 4px;
	}
	.sep { width: 3px; height: 3px; border-radius: 50%; background: currentColor; }

	.section-title {
		display: flex; align-items: baseline; justify-content: space-between;
		padding: 24px 28px 12px;
	}
	.section-title h3 {
		margin: 0; font-family: var(--font-display);
		font-size: 22px; font-weight: 500;
	}
	.eyebrow {
		font-size: 11px; letter-spacing: .18em;
		text-transform: uppercase; color: var(--ink-3); font-weight: 500;
	}

	.quickgrid {
		display: grid; grid-template-columns: 1fr 1fr;
		gap: 14px; padding: 0 28px 28px;
	}
	.qcard {
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 20px;
		cursor: pointer; text-align: left;
		transition: transform .15s, box-shadow .2s, border-color .15s;
		box-shadow: var(--sh-1); min-height: 148px;
		display: flex; flex-direction: column; justify-content: space-between;
		position: relative; overflow: hidden;
	}
	.qcard:hover { transform: translateY(-2px); box-shadow: var(--sh-2); border-color: var(--gold-400); }
	.qcard:active { transform: translateY(0); }
	.qcard.dark {
		background: linear-gradient(160deg, var(--navy-800), var(--navy-700));
		border-color: var(--navy-700); color: #fff;
	}
	.glyph {
		width: 52px; height: 52px; border-radius: 14px;
		background: var(--gold-50); display: grid; place-items: center;
		color: var(--gold-600); margin-bottom: 14px;
	}
	.glyph svg { width: 26px; height: 26px; stroke-width: 1.5; }
	.qcard.dark .glyph { background: rgba(200,164,92,.15); color: var(--gold-400); }
	.qtitle { font: 600 16px/1.2 var(--font-ui); margin-bottom: 4px; color: inherit; }
	.qdesc { font-size: 12px; color: var(--ink-3); line-height: 1.45; }
	.qcard.dark .qdesc { color: rgba(255,255,255,.55); }

	.concierge-banner {
		margin: 0 28px 28px;
		border-radius: var(--r-lg); padding: 22px 24px;
		background: linear-gradient(110deg, var(--navy-800) 0%, var(--navy-700) 75%, var(--gold-600) 180%);
		color: #fff;
		display: flex; align-items: center; gap: 16px;
		position: relative; overflow: hidden;
	}
	.concierge-banner::after {
		content: ""; position: absolute; right: -30px; top: -30px;
		width: 160px; height: 160px;
		background: radial-gradient(circle, rgba(200,164,92,.35), transparent 60%);
		pointer-events: none;
	}
	.pic {
		width: 56px; height: 56px; border-radius: 50%;
		background: repeating-linear-gradient(45deg, rgba(255,255,255,.1) 0 6px, rgba(255,255,255,.04) 6px 12px),
		var(--navy-900);
		flex-shrink: 0; border: 1px solid rgba(200,164,92,.4);
		display: grid; place-items: center;
		font: 500 11px/1 var(--font-mono); color: rgba(255,255,255,.4);
		position: relative; z-index: 1;
	}
	.ctxt { flex: 1; position: relative; z-index: 1; }
	.ctxt h4 { margin: 0 0 4px; font-family: var(--font-display); font-size: 18px; font-weight: 500; }
	.ctxt p { margin: 0; font-size: 12.5px; color: rgba(255,255,255,.7); line-height: 1.5; }
</style>
