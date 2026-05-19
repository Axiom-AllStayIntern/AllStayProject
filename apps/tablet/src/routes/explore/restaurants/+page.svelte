<script lang="ts">
	interface LocalRest {
		id: string;
		name: string;
		cuisine: string;
		priceRange: string;
		distance: string;
		hours: string;
		description: string;
		highlights: string[];
		imageUrl: string;
		isRecommended: boolean;
	}

	const localRestaurants: LocalRest[] = [
		{
			id: 'lr-001',
			name: 'Locavore',
			cuisine: 'Modern Indonesian',
			priceRange: '$$$',
			distance: '3.2 km · Ubud',
			hours: '12:00 – 14:30, 18:00 – 22:00',
			description: 'Award-winning fine dining celebrating hyper-local Balinese ingredients. One of Asia\'s 50 Best Restaurants.',
			highlights: ['Asia\'s 50 Best', 'Tasting menu', 'Local ingredients'],
			imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&auto=format&fit=crop',
			isRecommended: true
		},
		{
			id: 'lr-002',
			name: 'Mozaic Restaurant',
			cuisine: 'French-Asian Fusion',
			priceRange: '$$$',
			distance: '2.8 km · Ubud',
			hours: '18:30 – 22:00',
			description: 'Chef Chris Salans\' legendary garden restaurant. Seasonal French technique meets Balinese flavours under the stars.',
			highlights: ['Garden dining', 'Wine pairing', 'Chef\'s table'],
			imageUrl: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&auto=format&fit=crop',
			isRecommended: true
		},
		{
			id: 'lr-003',
			name: 'Naughty Nuri\'s Warung',
			cuisine: 'Balinese BBQ',
			priceRange: '$',
			distance: '4.1 km · Ubud',
			hours: '10:00 – 21:00',
			description: 'A Bali institution. Legendary pork ribs smothered in secret sauce and ice-cold Bintang. Always packed — worth the wait.',
			highlights: ['Legendary ribs', 'Local favourite', 'Casual vibes'],
			imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop',
			isRecommended: false
		},
		{
			id: 'lr-004',
			name: 'Merah Putih',
			cuisine: 'Modern Indonesian',
			priceRange: '$$',
			distance: '6.5 km · Seminyak',
			hours: '12:00 – 23:00',
			description: 'Spectacular soaring pavilion showcasing refined Indonesian cuisine from across the archipelago\'s 34 provinces.',
			highlights: ['Stunning interior', 'Cocktail bar', 'Vegetarian options'],
			imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop',
			isRecommended: false
		},
		{
			id: 'lr-005',
			name: 'Sardine',
			cuisine: 'Seafood & Mediterranean',
			priceRange: '$$',
			distance: '5.8 km · Seminyak',
			hours: '12:00 – 22:30',
			description: 'Romantic open-air pavilion overlooking rice paddies. Fresh daily catch, wood-fired dishes, and lush tropical garden setting.',
			highlights: ['Rice field views', 'Fresh catch daily', 'Romantic setting'],
			imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop',
			isRecommended: false
		}
	];
</script>

<div class="local-dining">
	<h1 class="page-title">Local Dining</h1>
	<p class="page-sub">Handpicked off-property restaurants recommended by our concierge team.</p>

	<div class="list">
		{#each localRestaurants as r}
			<div class="rest-card">
				<div class="rest-card__img-wrap">
					<img src={r.imageUrl} alt={r.name} class="rest-card__img" />
					{#if r.isRecommended}
						<span class="recommended-badge">⭐ Concierge Pick</span>
					{/if}
				</div>
				<div class="rest-card__body">
					<div class="rest-card__header">
						<h3 class="rest-card__name">{r.name}</h3>
						<span class="price-range">{r.priceRange}</span>
					</div>
					<p class="cuisine">{r.cuisine}</p>
					<p class="rest-card__desc">{r.description}</p>
					<div class="meta-row">
						<span class="meta-item">📍 {r.distance}</span>
						<span class="meta-item">🕐 {r.hours}</span>
					</div>
					<div class="highlights">
						{#each r.highlights as h}
							<span class="highlight-chip">{h}</span>
						{/each}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="concierge-note">
		<span class="concierge-icon">🔔</span>
		<p>Want a reservation? Ask our concierge — we'll handle the booking for you.</p>
	</div>
</div>

<style>
	.local-dining { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
	.page-sub { font-size: 13px; color: var(--color-text-muted); margin-bottom: 24px; }

	.list { display: flex; flex-direction: column; gap: 16px; }

	.rest-card {
		display: flex;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		overflow: hidden;
	}
	.rest-card__img-wrap { position: relative; width: 150px; flex-shrink: 0; }
	.rest-card__img { width: 100%; height: 100%; object-fit: cover; display: block; }
	.recommended-badge {
		position: absolute;
		bottom: 8px;
		left: 0;
		right: 0;
		text-align: center;
		background: rgba(0,0,0,0.65);
		color: var(--color-primary);
		font-size: 11px;
		font-weight: 700;
		padding: 4px 8px;
	}
	.rest-card__body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.rest-card__header { display: flex; align-items: center; gap: 8px; }
	.rest-card__name { font-size: 17px; font-weight: 700; }
	.price-range {
		font-size: 13px;
		font-weight: 700;
		color: var(--color-primary);
	}
	.cuisine { font-size: 12px; color: var(--color-text-muted); font-weight: 600; }
	.rest-card__desc { font-size: 13px; color: var(--color-text-muted); flex: 1; line-height: 1.5; }
	.meta-row { display: flex; gap: 16px; flex-wrap: wrap; }
	.meta-item { font-size: 12px; color: var(--color-text-muted); }
	.highlights { display: flex; gap: 6px; flex-wrap: wrap; }
	.highlight-chip {
		font-size: 11px;
		padding: 3px 10px;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.concierge-note {
		margin-top: 24px;
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		padding: 16px 20px;
	}
	.concierge-icon { font-size: 24px; }
	.concierge-note p { font-size: 14px; color: var(--color-text-muted); line-height: 1.5; }
</style>
