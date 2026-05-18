<script lang="ts">
	import { goto } from '$app/navigation';
	import { cartItemCount } from '$lib/stores/cart.js';
	import { language } from '$lib/stores/language.js';
	import { roomNumber } from '$lib/stores/room.js';

	function getTime() {
		return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
	}
	let time = getTime();
	setInterval(() => { time = getTime(); }, 30000);
</script>

<!-- Status bar -->
<div class="statusbar">
	<span>{time}</span>
	<div class="right"><span>Hotel Wi-Fi</span><span class="dot"></span><span>100%</span></div>
</div>

<!-- App header -->
<header class="appheader">
	{#if $roomNumber}
		<div class="room-pill">
			<span class="dot"></span>
			<span>Room&nbsp;<strong>{$roomNumber}</strong></span>
		</div>
	{/if}

	<div class="header-right">
		<div class="langtoggle lite" role="tablist">
			<button class:on={$language === 'en'} on:click={() => language.set('en')}>EN</button>
			<button class:on={$language === 'zh'} on:click={() => language.set('zh')}>中文</button>
		</div>
		<button class="icon-btn" on:click={() => goto('/cart')} aria-label="Cart">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
				<path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>
			</svg>
			{#if $cartItemCount > 0}
				<span class="cart-badge">{$cartItemCount > 99 ? '99+' : $cartItemCount}</span>
			{/if}
		</button>
	</div>
</header>

<style>
	.statusbar {
		height: 28px; padding: 6px 22px 0;
		display: flex; align-items: center; justify-content: space-between;
		font-size: 12px; font-weight: 500; color: var(--ink);
		pointer-events: none; background: var(--cream);
	}
	.statusbar .right { display: flex; gap: 8px; align-items: center; opacity: .85; }
	.statusbar .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .6; }

	.appheader {
		padding: 12px 28px 12px;
		background: var(--cream);
		display: flex; align-items: center; justify-content: space-between; gap: 12px;
		border-bottom: 1px solid rgba(0,0,0,.03);
		flex-shrink: 0;
	}

	.room-pill {
		display: inline-flex; align-items: center; gap: 8px;
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-pill); padding: 8px 16px;
		font-weight: 600; font-size: 13px; color: var(--navy-800);
		min-height: 36px;
	}
	.room-pill .dot {
		width: 6px; height: 6px; border-radius: 50%;
		background: var(--ok);
		box-shadow: 0 0 0 3px rgba(31,138,91,.18);
		flex-shrink: 0;
	}

	.header-right { display: flex; align-items: center; gap: 10px; }

	.icon-btn {
		width: 44px; height: 44px;
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-pill);
		display: grid; place-items: center;
		color: var(--navy-800); cursor: pointer;
		position: relative; transition: all .15s;
	}
	.icon-btn:hover { border-color: var(--gold-400); color: var(--gold-600); }

	.cart-badge {
		position: absolute; top: -4px; right: -4px;
		background: var(--warn); color: #fff;
		border: 2px solid var(--cream); border-radius: var(--r-pill);
		min-width: 20px; height: 20px; padding: 0 5px;
		font: 700 11px/16px var(--font-ui);
		display: flex; align-items: center; justify-content: center;
	}
</style>
