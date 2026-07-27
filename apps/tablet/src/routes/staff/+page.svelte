<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	export let data: PageData;

	const GENDER_ID: Record<string, string> = {
		male: 'Terapis pria',
		female: 'Terapis wanita',
		no_preference: 'Tanpa preferensi'
	};

	function timeLabel(ms: number): string {
		try {
			return new Date(ms).toLocaleString();
		} catch {
			return '';
		}
	}
</script>

<div class="wrap">
	<header>
		<div class="kicker">Cakrasoft Bridge · SPA Desk</div>
		<h1>Pesanan SPA Masuk</h1>
		<p class="sub">Work orders from the concierge — confirm each into Cakrasoft.</p>
	</header>

	{#if data.orders.length === 0}
		<div class="empty">Belum ada pesanan. (No work orders yet — confirm a spa booking via the voice concierge.)</div>
	{/if}

	<div class="list">
		{#each data.orders as o (o.confirmationCode)}
			<article class="card" class:done={o.status === 'confirmed'}>
				<div class="top">
					<span class="room">Kamar {o.roomId}</span>
					<span class="badge {o.status}">{o.status === 'confirmed' ? 'Terkonfirmasi' : 'Menunggu'}</span>
				</div>
				<h2>{o.treatmentNameId}</h2>
				<dl>
					<div><dt>Tanggal</dt><dd>{o.date}</dd></div>
					<div><dt>Jam</dt><dd>{o.time}</dd></div>
					<div><dt>Jumlah</dt><dd>{o.partySize ?? 1} tamu</dd></div>
					<div><dt>Terapis</dt><dd>{GENDER_ID[o.therapistGenderPref ?? 'no_preference']}</dd></div>
					{#if o.notes}<div><dt>Catatan</dt><dd>{o.notes}</dd></div>{/if}
					<div><dt>Kode</dt><dd class="code">{o.confirmationCode}</dd></div>
				</dl>

				{#if o.guestFlags.length}
					<div class="flags">
						{#each o.guestFlags as f}<span class="flag">⚠ {f}</span>{/each}
					</div>
				{/if}

				<div class="meta">{timeLabel(o.createdAt)}</div>

				{#if o.status !== 'confirmed'}
					<form method="POST" action="?/confirm" use:enhance>
						<input type="hidden" name="id" value={o.confirmationCode} />
						<button type="submit">Konfirmasi ke Cakrasoft</button>
					</form>
				{/if}
			</article>
		{/each}
	</div>
</div>

<style>
	.wrap { max-width: 760px; margin: 0 auto; padding: 28px 20px 60px; font-family: system-ui, sans-serif; }
	.kicker { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #4fd1c5; font-weight: 700; }
	h1 { margin: 6px 0 2px; font-size: 26px; }
	.sub { margin: 0 0 20px; color: #667; font-size: 14px; }
	.empty { background: #f6f8fa; border: 1px dashed #ccd; border-radius: 12px; padding: 28px; text-align: center; color: #778; }
	.list { display: flex; flex-direction: column; gap: 14px; }
	.card { border: 1px solid #e2e6ea; border-radius: 14px; padding: 16px 18px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
	.card.done { opacity: .62; }
	.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
	.room { font-weight: 700; color: #1a2744; }
	.badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; }
	.badge.pending { background: #fff3d6; color: #8a6d1a; }
	.badge.confirmed { background: #d9f2e0; color: #256b3c; }
	h2 { margin: 2px 0 10px; font-size: 19px; }
	dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin: 0 0 10px; }
	dl > div { display: flex; gap: 8px; font-size: 13.5px; }
	dt { color: #889; min-width: 62px; }
	dd { margin: 0; color: #1c2530; font-weight: 500; }
	.code { font-family: ui-monospace, monospace; }
	.flags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
	.flag { background: #fdecec; color: #a5352b; font-size: 12px; padding: 3px 9px; border-radius: 8px; font-weight: 600; }
	.meta { color: #99a; font-size: 11.5px; margin-bottom: 10px; }
	button { background: #1a2744; color: #fff; border: none; border-radius: 10px; padding: 10px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
	button:hover { background: #26386a; }
</style>
