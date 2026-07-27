<script lang="ts">
	import { enhance } from '$app/forms';
	import { room } from '$lib/stores/room.js';
	import { goto } from '$app/navigation';
	import type { ActionData } from './$types';

	export let form: ActionData;

	let lang: 'en' | 'zh' = 'en';
	let digits = '';

	const T = {
		en: {
			title: 'Welcome! Please enter your room number',
			sub: "We'll personalise the experience for your stay.",
			label: 'Room Number', confirm: 'Confirm',
			hint: 'Your room number can be found on your key card.'
		},
		zh: {
			title: '欢迎！请输入您的房间号',
			sub: '我们将为您定制专属体验。',
			label: '房间号', confirm: '确认',
			hint: '房间号可在您的房卡上找到。'
		}
	} as const;
	$: t = T[lang];

	function press(key: string) {
		if (key === 'del') { digits = digits.slice(0, -1); return; }
		if (key === 'ok') {
			if (digits.length >= 1) {
				room.setRoom(digits);
				goto('/home');
			}
			return;
		}
		if (/^\d$/.test(key) && digits.length < 4) digits += key;
	}

	$: slots = [0, 1, 2].map(i => digits[i] ?? null);
	$: canConfirm = digits.length >= 1;

	function getTime() {
		return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
	}
	let time = getTime();
	setInterval(() => { time = getTime(); }, 30000);
</script>

<div class="screen-wrap">
	<div class="statusbar">
		<span>{time}</span>
		<div class="right"><span>Hotel Wi-Fi</span><span class="dot"></span><span>100%</span></div>
	</div>

	<div class="roompage page-enter">
		<!-- Top nav -->
		<div class="topnav">
			<div class="brand">
				<div class="logo-mark-sm">A</div>
				<div class="brand-name-sm">
					<span class="all">All</span><span class="stay">Stay</span>
				</div>
			</div>
			<div class="langtoggle lite" role="tablist">
				<button class:on={lang === 'en'} on:click={() => lang = 'en'}>EN</button>
				<button class:on={lang === 'zh'} on:click={() => lang = 'zh'}>中文</button>
			</div>
		</div>

		<h2>{t.title}</h2>
		<p class="sub">{t.sub}</p>

		<!-- Room number display -->
		<div class="room-display">
			<div class="display-label">{t.label}</div>
			<div class="digits">
				{#each slots as slot, i}
					{#if slot !== null}
						<span class="digit-char">{slot}</span>
					{:else if i === digits.length}
						<span class="blink"></span>
					{:else}
						<span class="blank">—</span>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Keypad -->
		<div class="keypad">
			{#each ['1','2','3','4','5','6','7','8','9'] as k}
				<button class="key" on:click={() => press(k)}>{k}</button>
			{/each}
			<button class="key action" on:click={() => press('del')} aria-label="Delete">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
					<path d="M21 5H8l-5 7 5 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/>
					<line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
				</svg>
			</button>
			<button class="key" on:click={() => press('0')}>0</button>
			<button class="key confirm" on:click={() => press('ok')} disabled={!canConfirm}>{t.confirm}</button>
		</div>

		<!-- Hint -->
		<div class="keycard-hint">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="6" width="20" height="12" rx="2"/>
				<circle cx="8" cy="12" r="1.5"/>
				<line x1="13" y1="11" x2="19" y2="11"/>
				<line x1="13" y1="14" x2="17" y2="14"/>
			</svg>
			<span>{t.hint}</span>
		</div>
	</div>

	<div class="navbar">
		<i class="nb back"></i><i class="nb home"></i><i class="nb recent"></i>
	</div>
</div>

<style>
	.screen-wrap {
		min-height: 100vh;
		display: flex; flex-direction: column;
		background: linear-gradient(180deg, var(--cream) 0%, var(--cream-2) 100%);
		color: var(--ink);
	}

	.roompage {
		flex: 1;
		padding: 24px 56px 32px;
		display: flex; flex-direction: column;
		overflow-y: auto;
	}

	.topnav {
		display: flex; align-items: center; justify-content: space-between;
		margin-bottom: 8px;
	}
	.brand { display: flex; align-items: center; gap: 10px; }
	.logo-mark-sm {
		width: 36px; height: 36px; border-radius: 10px;
		background: linear-gradient(135deg, var(--gold-400), var(--gold-600));
		display: grid; place-items: center;
		font: 600 16px/1 var(--font-display);
		color: var(--navy-900);
	}
	.brand-name-sm {
		font-family: var(--font-display);
		font-size: 18px; font-weight: 500; letter-spacing: .2px;
	}
	.brand-name-sm .all { color: var(--navy-800); }
	.brand-name-sm .stay { color: var(--gold-600); font-style: italic; }

	h2 {
		font-family: var(--font-display);
		font-size: 40px; line-height: 1.1;
		margin: 36px 0 8px; font-weight: 500;
	}
	.sub { color: var(--ink-2); font-size: 15px; margin-bottom: 28px; }

	.room-display {
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 28px 32px;
		text-align: center; margin-bottom: 28px;
		box-shadow: var(--sh-1);
		min-height: 110px;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
	}
	.display-label {
		font-size: 11px; text-transform: uppercase;
		letter-spacing: .18em; color: var(--ink-3);
		margin-bottom: 12px;
	}
	.digits {
		font-family: var(--font-display);
		font-size: 60px; font-weight: 500;
		color: var(--navy-800); letter-spacing: 8px;
		min-height: 66px;
		display: flex; align-items: center; justify-content: center; gap: 2px;
	}
	.blank { color: var(--line-2); }
	.blink {
		width: 3px; height: 48px;
		background: var(--gold-500);
		margin-left: 4px;
		animation: blink 1s steps(2,end) infinite;
	}
	@keyframes blink { 50% { opacity: 0; } }

	.keypad {
		display: grid; grid-template-columns: repeat(3, 1fr);
		gap: 12px; margin-bottom: 24px;
	}
	.key {
		background: var(--white); border: 1px solid var(--line);
		border-radius: var(--r-md); height: 80px;
		font: 500 26px/1 var(--font-display);
		color: var(--navy-800); cursor: pointer;
		transition: transform .08s, background .15s, box-shadow .15s, border-color .15s;
		box-shadow: var(--sh-1);
		display: grid; place-items: center;
	}
	.key:hover { border-color: var(--gold-400); }
	.key:active { background: var(--gold-50); transform: scale(.96); box-shadow: 0 0 0 4px rgba(200,164,92,.18); }
	.key.action {
		font-family: var(--font-ui); font-size: 14px;
		letter-spacing: .04em; color: var(--ink-2);
	}
	.key.confirm {
		background: var(--navy-800); color: #fff;
		border-color: var(--navy-800);
		font-family: var(--font-ui); font-size: 14px;
		letter-spacing: .04em; font-weight: 600;
	}
	.key.confirm:hover:not(:disabled) { background: var(--navy-700); }
	.key.confirm:disabled {
		background: var(--line); color: var(--ink-3);
		border-color: var(--line); cursor: not-allowed;
	}

	.keycard-hint {
		margin-top: auto;
		font-size: 13px; color: var(--ink-3);
		display: flex; align-items: center; justify-content: center; gap: 8px;
	}
</style>
