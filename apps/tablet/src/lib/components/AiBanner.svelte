<script lang="ts">
	import { voiceReply } from '$lib/stores/voice-reply.js';
	import { page } from '$app/stores';
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';

	let autoDismiss: ReturnType<typeof setTimeout>;

	// Auto-dismiss after 8 s, reset timer whenever the message changes
	$: if ($voiceReply) {
		clearTimeout(autoDismiss);
		autoDismiss = setTimeout(() => voiceReply.clear(), 8000);
	}

	onDestroy(() => clearTimeout(autoDismiss));

	// Don't show on standalone pages
	const STANDALONE = ['/login', '/room-select', '/confirmation'];
	$: hidden = STANDALONE.some((p) => $page.url.pathname.startsWith(p));
</script>

{#if $voiceReply && !hidden}
	<div class="ai-banner" role="status">
		<div class="avatar">Ari</div>
		<p class="msg">{$voiceReply.message}</p>
		<button class="close" on:click={() => voiceReply.clear()} aria-label={$_('voice.dismiss')}>✕</button>
	</div>
{/if}

<style>
	.ai-banner {
		position: fixed;
		bottom: 80px; /* above BottomNav */
		left: 16px;
		right: 16px;
		background: linear-gradient(110deg, var(--navy-800, #1a2744) 0%, var(--navy-700, #223060) 100%);
		color: #fff;
		border-radius: 16px;
		padding: 14px 16px;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
		z-index: 150;
		animation: slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(200, 164, 92, 0.2);
		border: 1px solid rgba(200, 164, 92, 0.5);
		display: grid;
		place-items: center;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.05em;
		color: #c8a45c;
		flex-shrink: 0;
	}

	.msg {
		flex: 1;
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.92);
		padding-top: 6px;
	}

	.close {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.45);
		cursor: pointer;
		font-size: 13px;
		padding: 4px;
		flex-shrink: 0;
		line-height: 1;
	}
	.close:hover { color: #fff; }

	@keyframes slide-up {
		from { opacity: 0; transform: translateY(20px); }
		to   { opacity: 1; transform: translateY(0); }
	}
</style>
