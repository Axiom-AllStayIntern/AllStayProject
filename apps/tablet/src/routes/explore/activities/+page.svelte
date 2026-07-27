<script lang="ts">
	import { formatPrice } from '$lib/utils/format.js';

	interface Activity {
		id: string;
		icon: string;
		name: string;
		description: string;
		duration: string;
		price: number;
		tag: string;
		imageUrl: string;
	}

	const activities: Activity[] = [
		{
			id: 'act-001',
			icon: '🏄',
			name: 'Surf Lesson',
			description: 'Learn to ride the waves with certified instructors at Kuta Beach. Suitable for beginners and intermediate surfers.',
			duration: '2 hrs',
			price: 350000,
			tag: 'Water Sports',
			imageUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400&auto=format&fit=crop'
		},
		{
			id: 'act-002',
			icon: '🍳',
			name: 'Balinese Cooking Class',
			description: 'Visit a local market, then cook five traditional dishes with a Balinese family. Take the recipe book home.',
			duration: '3 hrs',
			price: 450000,
			tag: 'Cultural',
			imageUrl: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=400&auto=format&fit=crop'
		},
		{
			id: 'act-003',
			icon: '🛕',
			name: 'Temple & Rice Terrace Tour',
			description: "Guided cultural journey through Ubud's iconic temples and the UNESCO-listed Tegallalang rice terraces.",
			duration: '4 hrs',
			price: 300000,
			tag: 'Cultural',
			imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&auto=format&fit=crop'
		},
		{
			id: 'act-004',
			icon: '⛵',
			name: 'Sunset Sailing Cruise',
			description: 'Sail along the Jimbaran coastline as the sun sets over the horizon. Includes drinks and light canapés.',
			duration: '2 hrs',
			price: 800000,
			tag: 'Ocean',
			imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop'
		},
		{
			id: 'act-005',
			icon: '🚣',
			name: 'White Water Rafting',
			description: 'Thrilling Grade III rapids along the Ayung River through lush jungle gorges. All safety equipment provided.',
			duration: '3 hrs',
			price: 600000,
			tag: 'Adventure',
			imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&auto=format&fit=crop'
		},
		{
			id: 'act-006',
			icon: '🚴',
			name: 'Sunrise Cycling Tour',
			description: "Pedal downhill through Kintamani's volcanic highlands as the sun rises over Mount Batur. Breakfast included.",
			duration: '3 hrs',
			price: 250000,
			tag: 'Outdoors',
			imageUrl: 'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=400&auto=format&fit=crop'
		}
	];

	let selected: Activity | null = null;
</script>

<div class="activities">
	<h1 class="page-title">Activities & Experiences</h1>
	<p class="page-sub">Curated by our concierge team — book through us for guaranteed best rates.</p>

	<div class="list">
		{#each activities as act}
			<div class="activity-card">
				<img src={act.imageUrl} alt={act.name} class="activity-card__img" />
				<div class="activity-card__body">
					<div class="activity-card__top">
						<span class="tag">{act.tag}</span>
					</div>
					<h3 class="activity-card__name">{act.icon} {act.name}</h3>
					<p class="activity-card__desc">{act.description}</p>
					<div class="activity-card__footer">
						<div class="meta">
							<span class="meta-item">⏱ {act.duration}</span>
							<span class="price">{formatPrice(act.price)} / person</span>
						</div>
						<button class="btn-book" on:click={() => selected = act}>Book</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

{#if selected}
	<div class="overlay" role="dialog">
		<div class="modal">
			<h2>{selected.icon} {selected.name}</h2>
			<p class="modal-desc">{selected.description}</p>
			<div class="modal-meta">
				<span>⏱ {selected.duration}</span>
				<span class="price">{formatPrice(selected.price)} / person</span>
			</div>
			<p class="modal-note">Our concierge will confirm availability and contact you in your room within 30 minutes.</p>
			<button class="btn-confirm" on:click={() => selected = null}>Request Booking</button>
			<button class="btn-cancel" on:click={() => selected = null}>Cancel</button>
		</div>
	</div>
{/if}

<style>
	.activities { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
	.page-sub { font-size: 13px; color: var(--color-text-muted); margin-bottom: 24px; }

	.list { display: flex; flex-direction: column; gap: 16px; }

	.activity-card {
		display: flex;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		overflow: hidden;
	}
	.activity-card__img { width: 150px; object-fit: cover; flex-shrink: 0; }
	.activity-card__body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 8px; }
	.activity-card__top { display: flex; }
	.tag {
		font-size: 11px;
		font-weight: 600;
		background: rgba(var(--gold-rgb, 180, 140, 60), 0.15);
		color: var(--color-primary);
		padding: 2px 10px;
		border-radius: 999px;
		border: 1px solid var(--color-primary);
	}
	.activity-card__name { font-size: 17px; font-weight: 700; }
	.activity-card__desc { font-size: 13px; color: var(--color-text-muted); flex: 1; line-height: 1.5; }
	.activity-card__footer { display: flex; align-items: center; justify-content: space-between; }
	.meta { display: flex; gap: 16px; align-items: center; }
	.meta-item { font-size: 12px; color: var(--color-text-muted); }
	.price { font-size: 14px; font-weight: 700; color: var(--color-primary); }

	.btn-book {
		background: var(--color-primary);
		color: #000;
		font-weight: 700;
		padding: 10px 20px;
		border-radius: 10px;
		font-size: 14px;
	}

	/* Modal */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
	}
	.modal {
		background: var(--color-surface);
		border-radius: 20px;
		padding: 32px;
		width: 460px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.modal h2 { font-size: 22px; font-weight: 700; }
	.modal-desc { font-size: 14px; color: var(--color-text-muted); line-height: 1.6; }
	.modal-meta { display: flex; gap: 20px; font-size: 14px; }
	.modal-note {
		font-size: 13px;
		color: var(--color-text-muted);
		background: var(--color-border);
		padding: 12px 16px;
		border-radius: 10px;
		line-height: 1.5;
	}
	.btn-confirm {
		background: var(--color-primary);
		color: #000;
		font-weight: 700;
		padding: 14px;
		border-radius: 12px;
		font-size: 16px;
	}
	.btn-cancel { color: var(--color-text-muted); padding: 8px; }
</style>
