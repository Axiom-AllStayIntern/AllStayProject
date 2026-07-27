<script lang="ts">
	import { idle } from '$lib/stores/idle.js';
</script>

{#if $idle}
	<div class="screensaver" role="presentation" on:click={idle.dismiss}>
		<div class="ss-content">
			<div class="ss-logo">A</div>
			<div class="ss-brand">
				<span class="all">All</span><span class="stay">Stay</span>
			</div>
			<p class="ss-tap">Tap to continue · 轻触屏幕继续</p>
		</div>
	</div>
{/if}

<style>
	.screensaver {
		position: fixed; inset: 0; z-index: 1000;
		background:
			radial-gradient(700px 500px at 75% 10%, rgba(200,164,92,.2), transparent 60%),
			radial-gradient(900px 700px at 20% 100%, rgba(36,53,89,.5), transparent 60%),
			linear-gradient(160deg, #0f1a30 0%, #1a2744 55%, #243559 100%);
		display: flex; align-items: center; justify-content: center;
	}
	.ss-content {
		display: flex; flex-direction: column; align-items: center; gap: 20px;
		animation: pulse 3s ease-in-out infinite;
	}
	.ss-logo {
		width: 72px; height: 72px; border-radius: 20px;
		background: linear-gradient(135deg, var(--gold-400), var(--gold-600));
		display: grid; place-items: center;
		font: 600 32px/1 var(--font-display);
		color: var(--navy-900);
		box-shadow: 0 12px 32px rgba(0,0,0,.4);
	}
	.ss-brand {
		font-family: var(--font-display); font-size: 36px; font-weight: 500;
	}
	.ss-brand .all { color: #fff; }
	.ss-brand .stay { color: var(--gold-400); font-style: italic; }
	.ss-tap { color: rgba(255,255,255,.5); font-size: 14px; }

	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
</style>
