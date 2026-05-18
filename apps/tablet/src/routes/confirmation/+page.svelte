<script lang="ts">
	import { goto } from '$app/navigation';
	import { language } from '$lib/stores/language.js';
	import type { PageData } from './$types';

	export let data: PageData;

	$: lang = $language;

	function fmtIDR(n: number) {
		return n ? n.toLocaleString('en-US').replace(/,/g, ' ') + ' IDR' : '—';
	}

	const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
	const total = url ? Number(url.searchParams.get('total') ?? 0) : 0;
	const room  = url ? (url.searchParams.get('room') ?? data.orderId) : data.orderId;

	const eta = '25–35 min';

	const T = {
		en: {
			title: 'Order Confirmed!',
			sub: "We've sent your order to the kitchen. You'll receive a notification when it's on its way.",
			orderNo: 'Order No.', deliveryTo: 'Delivery to',
			roomLabel: 'Room', eta: 'Estimated arrival',
			totalLabel: 'Total', returnHome: 'Return to Home'
		},
		zh: {
			title: '订单已确认！',
			sub: '订单已送达厨房，出餐时您将收到通知。',
			orderNo: '订单号', deliveryTo: '送至',
			roomLabel: '房间', eta: '预计送达',
			totalLabel: '总计', returnHome: '返回首页'
		}
	} as const;
	$: t = T[lang];

	function handleReturn() {
		goto('/home');
	}
</script>

<div class="screen-wrap">
	<div class="statusbar">
		<span></span>
		<div class="right"><span>Hotel Wi-Fi</span><span class="dot"></span><span>100%</span></div>
	</div>

	<div class="confirm-page page-enter">
		<div class="check-circle">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
		</div>

		<h1>{t.title}</h1>
		<p class="lead">{t.sub}</p>

		<div class="order-card">
			<div class="o-row">
				<span class="lbl">{t.orderNo}</span>
				<span class="val mono">{data.orderId || `ALL-${Date.now().toString().slice(-6)}`}</span>
			</div>
			<div class="o-row">
				<span class="lbl">{t.deliveryTo}</span>
				<span class="val">{t.roomLabel} {room}</span>
			</div>
			<div class="o-row">
				<span class="lbl">{t.eta}</span>
				<span class="val">{eta}</span>
			</div>
			<div class="o-row tot">
				<span class="lbl">{t.totalLabel}</span>
				<span class="val">{fmtIDR(total)}</span>
			</div>
		</div>

		<button class="btn btn-primary" style="min-width:280px;" on:click={handleReturn}>
			{t.returnHome}
		</button>
	</div>

	<div class="navbar">
		<i class="nb back"></i><i class="nb home"></i><i class="nb recent"></i>
	</div>
</div>

<style>
	.screen-wrap {
		min-height: 100vh; display: flex; flex-direction: column;
		background:
			radial-gradient(900px 600px at 50% -10%, rgba(31,138,91,.16), transparent 60%),
			var(--cream);
	}

	.confirm-page {
		flex: 1; display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		padding: 40px 56px; text-align: center;
	}

	.check-circle {
		width: 120px; height: 120px; border-radius: 50%;
		background: linear-gradient(135deg, #2ea776, #1f8a5b);
		display: grid; place-items: center; color: #fff;
		margin-bottom: 32px;
		box-shadow: 0 16px 40px rgba(31,138,91,.35);
		animation: pop .5s cubic-bezier(.34,1.6,.64,1) both;
	}
	.check-circle svg { width: 60px; height: 60px; }
	@keyframes pop { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }

	h1 {
		font-family: var(--font-display);
		font-size: 44px; font-weight: 500; margin: 0 0 12px;
	}
	.lead { color: var(--ink-2); font-size: 15px; max-width: 420px; margin: 0 0 32px; line-height: 1.6; }

	.order-card {
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-lg); box-shadow: var(--sh-2);
		width: 100%; max-width: 460px;
		padding: 24px 28px; margin-bottom: 32px; text-align: left;
	}
	.o-row {
		display: flex; justify-content: space-between; align-items: center;
		padding: 12px 0; border-bottom: 1px dashed var(--line);
		font-size: 14px;
	}
	.o-row:last-child { border-bottom: none; }
	.lbl { color: var(--ink-3); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
	.val { font-weight: 600; color: var(--ink); }
	.mono { font-family: var(--font-mono); font-size: 13px; }
	.o-row.tot .val {
		font-family: var(--font-display); font-size: 22px;
		font-weight: 500; color: var(--navy-800);
	}

	.statusbar {
		height: 28px; padding: 6px 22px 0;
		display: flex; align-items: center; justify-content: space-between;
		font-size: 12px; font-weight: 500; color: var(--ink);
	}
	.statusbar .right { display: flex; gap: 8px; align-items: center; opacity: .85; }
	.statusbar .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .6; }
</style>
