<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import { cart, cartItemCount } from '$lib/stores/cart.js';
	import { language } from '$lib/stores/language.js';
	import { goto } from '$app/navigation';

	$: lang = $language;

	const T = {
		en: {
			title: 'My Cart', empty: 'Your cart is empty',
			emptyDesc: 'Browse the menu and add what tempts you.',
			browse: 'Browse menu', subtotal: 'Subtotal',
			service: 'Service charge (10%)', total: 'Total',
			confirm: 'Confirm Order'
		},
		zh: {
			title: '我的购物车', empty: '购物车空空如也',
			emptyDesc: '浏览菜单，把心动的加进来吧。',
			browse: '浏览菜单', subtotal: '小计',
			service: '服务费 (10%)', total: '总计',
			confirm: '确认订单'
		}
	} as const;
	$: t = T[lang as keyof typeof T] ?? T.en;

	function fmtIDR(n: number) {
		return n.toLocaleString('en-US').replace(/,/g, ' ') + ' IDR';
	}

	$: service = Math.round($cart.subtotal * 0.1);
	$: grandTotal = $cart.subtotal + service;

	async function confirmOrder() {
		const res = await fetch('/api/order', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items: $cart.items })
		});
		const data = await res.json().catch(() => ({ orderId: `ALL-${Date.now()}` }));
		cart.clear();
		goto(`/confirmation?orderId=${data.orderId ?? `ALL-${Date.now()}`}&total=${grandTotal}&room=${$cart.roomId}`);
	}
</script>

<div class="shell">
	<Header />
	<div class="body page-enter">
		<main class="main scroll">
			<div class="cart-hero">
				<h2>{t.title}</h2>
				<div class="sub">
					{$cartItemCount > 0
						? (lang === 'zh' ? `共 ${$cartItemCount} 件 · 准备结算` : `${$cartItemCount} item${$cartItemCount === 1 ? '' : 's'} · ready to check out`)
						: t.empty}
				</div>
			</div>

			{#if $cartItemCount === 0}
				<div class="cart-empty">
					<div class="icn">
						<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" color="var(--ink-3)">
							<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
							<path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
						</svg>
					</div>
					<h3>{t.empty}</h3>
					<p>{t.emptyDesc}</p>
					<button class="btn btn-primary" style="margin-top:20px; padding: 0 32px;" on:click={() => goto('/dining')}>
						{t.browse}
					</button>
				</div>
			{:else}
				<div class="cart-groups">
					<div class="cart-group">
						<div class="cart-group-title">
							<span class="gd"></span>
							{lang === 'zh' ? '餐饮' : 'Dining'}
						</div>
						{#each $cart.items as item (item.id)}
							<div class="cart-row">
								<div class="ct-thumb"></div>
								<div class="ct-info">
									<div class="ct-name">{item.name}</div>
									{#if item.specialInstructions}
										<div class="ct-special">
											{lang === 'zh' ? '备注' : 'Note'}: {item.specialInstructions}
										</div>
									{/if}
									<div class="ct-controls">
										<div class="qty sm">
											<button disabled={item.quantity <= 1} on:click={() => cart.updateQuantity(item.id, item.quantity - 1)}>−</button>
											<span class="num">{item.quantity}</span>
											<button on:click={() => cart.updateQuantity(item.id, item.quantity + 1)}>+</button>
										</div>
										<span class="ct-price">{fmtIDR(item.price * item.quantity)}</span>
									</div>
								</div>
								<button class="ct-del" on:click={() => cart.removeItem(item.id)} aria-label="Remove">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
										<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
										<path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</main>

		{#if $cartItemCount > 0}
			<div class="cart-summary">
				<div class="sum-row"><span>{t.subtotal}</span><span>{fmtIDR($cart.subtotal)}</span></div>
				<div class="sum-row"><span>{t.service}</span><span>{fmtIDR(service)}</span></div>
				<div class="sum-row total">
					<span>{t.total}</span>
					<span class="val">{fmtIDR(grandTotal)}</span>
				</div>
				<button class="btn btn-primary btn-block" on:click={confirmOrder}>{t.confirm}</button>
			</div>
		{/if}
	</div>
	<BottomNav />
</div>

<style>
	.shell { height: 100vh; display: flex; flex-direction: column; background: var(--cream); }
	.body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
	.main { flex: 1; overflow-y: auto; }

	.cart-hero { padding: 20px 28px 6px; }
	.cart-hero h2 { margin: 0 0 6px; font-family: var(--font-display); font-size: 34px; font-weight: 500; }
	.cart-hero .sub { color: var(--ink-3); font-size: 13.5px; }

	.cart-empty {
		flex: 1; display: flex; flex-direction: column; align-items: center;
		justify-content: center; text-align: center; padding: 40px 40px;
		color: var(--ink-3);
	}
	.icn {
		width: 84px; height: 84px; border-radius: 50%;
		background: var(--cream-2); display: grid; place-items: center;
		margin-bottom: 18px; color: var(--ink-3);
	}
	.cart-empty h3 { font-family: var(--font-display); font-size: 24px; font-weight: 500; color: var(--ink); margin: 0 0 6px; }
	.cart-empty p { font-size: 14px; }

	.cart-groups { padding: 16px 28px 24px; }
	.cart-group { margin-bottom: 20px; }
	.cart-group-title {
		font-size: 11px; letter-spacing: .18em; text-transform: uppercase;
		color: var(--ink-3); font-weight: 600;
		padding: 0 4px 8px; border-bottom: 1px solid var(--line);
		margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
	}
	.gd { width: 6px; height: 6px; border-radius: 50%; background: var(--gold-500); }
	.cart-row {
		display: flex; gap: 14px; padding: 12px 4px;
		border-bottom: 1px solid var(--line); align-items: flex-start;
	}
	.cart-row:last-child { border-bottom: none; }
	.ct-thumb {
		width: 56px; height: 56px; border-radius: var(--r-sm); flex-shrink: 0;
		background: repeating-linear-gradient(135deg, var(--cream-2) 0 6px, var(--cream) 6px 12px);
		border: 1px solid var(--line-2);
	}
	.ct-info { flex: 1; min-width: 0; }
	.ct-name { font: 600 14px/1.3 var(--font-ui); margin-bottom: 2px; }
	.ct-special {
		font-size: 12px; color: var(--ink-3);
		background: var(--cream-2); border-radius: var(--r-sm);
		padding: 6px 8px; margin-top: 6px; line-height: 1.4;
	}
	.ct-controls {
		display: flex; align-items: center; justify-content: space-between; margin-top: 8px;
	}
	.ct-price { font-weight: 600; font-size: 14px; color: var(--navy-800); }

	.qty { display: flex; align-items: center; gap: 10px; }
	.qty.sm button {
		width: 30px; height: 30px; border-radius: 50%;
		border: 1px solid var(--line); background: var(--white);
		font: 500 16px/1 var(--font-ui); color: var(--navy-800);
		cursor: pointer; display: grid; place-items: center; transition: all .15s;
	}
	.qty.sm button:disabled { color: var(--ink-3); cursor: not-allowed; }
	.num { font-weight: 600; font-size: 14px; min-width: 20px; text-align: center; }

	.ct-del {
		background: none; border: none; cursor: pointer;
		width: 32px; height: 32px; color: var(--ink-3); border-radius: 50%;
		display: grid; place-items: center; transition: all .15s; flex-shrink: 0;
	}
	.ct-del:hover { color: var(--warn); background: rgba(196,90,61,.08); }

	.cart-summary {
		background: var(--white); border-top: 1px solid var(--line);
		padding: 18px 28px; flex-shrink: 0;
	}
	.sum-row {
		display: flex; justify-content: space-between;
		font-size: 14px; color: var(--ink-2); padding: 4px 0;
	}
	.sum-row.total {
		font-size: 16px; font-weight: 600; color: var(--ink);
		padding-top: 10px; margin-top: 6px;
		border-top: 1px dashed var(--line);
	}
	.sum-row.total .val {
		font-family: var(--font-display); font-size: 26px;
		font-weight: 500; color: var(--navy-800);
	}
	.cart-summary .btn { margin-top: 14px; }
</style>
