<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Screensaver from '$lib/components/Screensaver.svelte';
	import { idle } from '$lib/stores/idle.js';
	import { onMount } from 'svelte';
	import { setupI18n } from '$lib/i18n/index.js';

	setupI18n();

	// Pages that manage their own full-screen layout (no shell wrapper needed)
	const STANDALONE = ['/login', '/room-select', '/confirmation'];
	$: isStandalone = STANDALONE.some((p) => $page.url.pathname.startsWith(p));

	onMount(() => {
		if (!isStandalone) idle.start();
		return () => idle.stop();
	});
</script>

<Screensaver />

<slot />
