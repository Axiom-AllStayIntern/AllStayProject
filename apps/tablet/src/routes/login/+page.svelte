<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { language } from '$lib/stores/language.js';
	import { _ } from 'svelte-i18n';

	export let form: ActionData;

	let showPw = false;
	let staffId = '';
	let password = '';

	function getTime() {
		return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
	}
	let time = getTime();
	setInterval(() => { time = getTime(); }, 30000);
</script>

<div class="screen-wrap">
	<!-- Status bar -->
	<div class="statusbar light">
		<span>{time}</span>
		<div class="right"><span>{$_('header.wifi')}</span><span class="dot"></span><span>100%</span></div>
	</div>

	<div class="login page-enter">
		<!-- Brand row -->
		<div class="brandrow">
			<div class="brand">
				<div class="logo-mark">A</div>
				<div class="brand-name"><span class="all">All</span><span class="stay">Stay</span></div>
			</div>
			<div class="langtoggle" role="tablist">
				<button class:on={$language === 'en'} on:click={() => language.set('en')}>EN</button>
				<button class:on={$language === 'zh'} on:click={() => language.set('zh')}>中文</button>
				<button class:on={$language === 'id'} on:click={() => language.set('id')}>ID</button>
			</div>
		</div>

		<!-- Hero -->
		<div class="hero">
			<h1>{$_('login.hero1')}<br><em>{$_('login.hero2')}</em></h1>
			<p class="sub">{$_('login.subtitle')}</p>
		</div>

		<!-- Form -->
		<form class="form-card" method="POST" use:enhance>
			{#if form?.error}
				<p class="form-error">{form.error}</p>
			{/if}

			<div class="field">
				<label for="staff-id">{$_('login.staffId')}</label>
				<div class="input-wrap">
					<input id="staff-id" type="text" placeholder={$_('login.staffIdExample')} name="staffId" bind:value={staffId} autocomplete="off" />
				</div>
			</div>

			<div class="field">
				<label for="staff-password">{$_('login.password')}</label>
				<div class="input-wrap">
					{#if showPw}
						<input id="staff-password" type="text" name="pin" placeholder="••••••••" bind:value={password} autocomplete="current-password" />
					{:else}
						<input id="staff-password" type="password" name="pin" placeholder="••••••••" bind:value={password} autocomplete="current-password" />
					{/if}
					<button type="button" class="eye" on:click={() => showPw = !showPw} aria-label={$_('login.togglePassword')}>
						{#if showPw}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
								<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
								<line x1="1" y1="1" x2="23" y2="23"/>
							</svg>
						{:else}
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
								<circle cx="12" cy="12" r="3"/>
							</svg>
						{/if}
					</button>
				</div>
			</div>

			<div class="field" style="margin-top: 28px;">
				<button type="submit" class="btn btn-primary btn-block">{$_('login.submit')}</button>
			</div>
		</form>

		<p class="footer-hint">{$_('login.hint')}</p>
	</div>

	<div class="navbar dark">
		<i class="nb back"></i><i class="nb home"></i><i class="nb recent"></i>
	</div>
</div>

<style>
	.screen-wrap {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background:
			radial-gradient(700px 500px at 75% 10%, rgba(200,164,92,.25), transparent 60%),
			radial-gradient(900px 700px at 20% 100%, rgba(36,53,89,.6), transparent 60%),
			linear-gradient(160deg, #0f1a30 0%, #1a2744 55%, #243559 100%);
		color: #fff;
	}

	.login {
		flex: 1;
		padding: 36px 56px 40px;
		display: flex;
		flex-direction: column;
	}

	.brandrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.brand { display: flex; align-items: center; gap: 14px; }

	.logo-mark {
		width: 48px; height: 48px; border-radius: 14px;
		background: linear-gradient(135deg, var(--gold-400), var(--gold-600));
		display: grid; place-items: center;
		font: 600 22px/1 var(--font-display);
		color: var(--navy-900);
		box-shadow: 0 8px 24px rgba(0,0,0,.3);
		flex-shrink: 0;
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: 26px; font-weight: 500; letter-spacing: .5px;
	}
	.brand-name .all { color: #fff; }
	.brand-name .stay { color: var(--gold-400); font-style: italic; }

	.hero { margin-top: 64px; margin-bottom: 40px; }
	.hero h1 {
		font-family: var(--font-display);
		font-size: 52px; line-height: 1.05;
		margin: 0 0 18px; font-weight: 400; letter-spacing: .2px;
	}
	.hero h1 em { color: var(--gold-400); font-style: italic; }
	.hero .sub { color: rgba(255,255,255,.65); font-size: 15px; max-width: 380px; line-height: 1.55; }

	.form-card {
		margin-top: auto;
		background: rgba(255,255,255,.06);
		border: 1px solid rgba(255,255,255,.1);
		border-radius: var(--r-xl);
		padding: 32px;
		backdrop-filter: blur(20px);
	}
	.form-error {
		color: #ffb3a7; font-size: 13px;
		background: rgba(196,90,61,.2);
		border-radius: var(--r-sm);
		padding: 8px 12px;
		margin-bottom: 16px;
	}
	.field { margin-bottom: 18px; }
	.field:last-of-type { margin-bottom: 0; }
	.field label {
		display: block; font-size: 11px; letter-spacing: .14em;
		text-transform: uppercase; color: rgba(255,255,255,.55);
		margin-bottom: 10px; font-weight: 500;
	}
	.input-wrap {
		position: relative; display: flex; align-items: center;
		background: rgba(255,255,255,.05);
		border: 1px solid rgba(255,255,255,.14);
		border-radius: var(--r-md);
		transition: border-color .2s, background .2s;
	}
	.input-wrap:focus-within {
		border-color: var(--gold-400);
		background: rgba(255,255,255,.08);
	}
	.input-wrap input {
		flex: 1; border: none; background: transparent;
		color: #fff; font: 500 16px/1 var(--font-ui);
		padding: 18px; outline: none; min-height: 44px;
	}
	.input-wrap input::placeholder { color: rgba(255,255,255,.35); }
	.eye {
		width: 44px; height: 44px; display: grid; place-items: center;
		color: rgba(255,255,255,.55);
		transition: color .15s;
	}
	.eye:hover { color: var(--gold-400); }

	.footer-hint {
		margin-top: 24px;
		font-size: 12px; color: rgba(255,255,255,.45);
		text-align: center; letter-spacing: .04em;
	}
</style>
