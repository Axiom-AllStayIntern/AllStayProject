<script lang="ts">
	interface ExternalSpa {
		id: string;
		name: string;
		type: string;
		priceRange: string;
		distance: string;
		hours: string;
		description: string;
		tags: string[];
		imageUrl: string;
		isRecommended: boolean;
	}

	const spas: ExternalSpa[] = [
		{
			id: 'es-001',
			name: 'Taksu Spa',
			type: 'Day Spa',
			priceRange: '$$',
			distance: '2.4 km · Ubud',
			hours: '09:00 – 21:00',
			description: 'Set in a serene jungle ravine, Taksu blends traditional Balinese healing with contemporary wellness. Famous for their flower bath ritual.',
			tags: ['Flower Bath', 'Jungle Setting', 'Balinese Healing'],
			imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&auto=format&fit=crop',
			isRecommended: true
		},
		{
			id: 'es-002',
			name: 'The Yoga Barn',
			type: 'Yoga & Wellness',
			priceRange: '$',
			distance: '3.1 km · Ubud',
			hours: '07:00 – 21:00',
			description: 'Bali\'s most beloved wellness hub. Daily yoga and meditation classes, sound healing, ecstatic dance, and holistic healing therapies.',
			tags: ['Yoga Classes', 'Sound Healing', 'Meditation', 'Ecstatic Dance'],
			imageUrl: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&auto=format&fit=crop',
			isRecommended: true
		},
		{
			id: 'es-003',
			name: 'Bodyworks Bali',
			type: 'Massage Spa',
			priceRange: '$',
			distance: '1.8 km · Seminyak',
			hours: '09:00 – 22:00',
			description: 'No-frills, no-nonsense massage clinic with trained therapists. The go-to for excellent deep tissue, reflexology, and body scrubs at fair prices.',
			tags: ['Deep Tissue', 'Reflexology', 'Walk-ins Welcome'],
			imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&auto=format&fit=crop',
			isRecommended: false
		},
		{
			id: 'es-004',
			name: 'Fivelements Retreat',
			type: 'Wellness Retreat',
			priceRange: '$$$',
			distance: '8.5 km · Mambal',
			hours: '08:00 – 20:00',
			description: 'A sacred riverside wellness sanctuary rooted in Balinese Panca Mahabhuta philosophy. Transformative healing programs, raw cuisine, and Balinese purification rituals.',
			tags: ['Retreat Programs', 'Sacred Rituals', 'Raw Cuisine', 'Riverside'],
			imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&auto=format&fit=crop',
			isRecommended: false
		}
	];
</script>

<div class="ext-spa">
	<h1 class="page-title">External Wellness</h1>
	<p class="page-sub">Off-property spas and wellness experiences recommended by our concierge.</p>

	<div class="list">
		{#each spas as spa}
			<div class="spa-card">
				<div class="spa-card__img-wrap">
					<img src={spa.imageUrl} alt={spa.name} class="spa-card__img" />
					{#if spa.isRecommended}
						<span class="recommended-badge">⭐ Concierge Pick</span>
					{/if}
				</div>
				<div class="spa-card__body">
					<div class="spa-card__header">
						<h3 class="spa-card__name">{spa.name}</h3>
						<span class="price-range">{spa.priceRange}</span>
					</div>
					<p class="spa-type">{spa.type}</p>
					<p class="spa-card__desc">{spa.description}</p>
					<div class="meta-row">
						<span class="meta-item">📍 {spa.distance}</span>
						<span class="meta-item">🕐 {spa.hours}</span>
					</div>
					<div class="tags">
						{#each spa.tags as tag}
							<span class="tag-chip">{tag}</span>
						{/each}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="concierge-note">
		<span class="concierge-icon">🔔</span>
		<p>Need transport or a booking? Our concierge can arrange everything, including a hotel car to take you there.</p>
	</div>
</div>

<style>
	.ext-spa { padding: 24px; }
	.page-title { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
	.page-sub { font-size: 13px; color: var(--color-text-muted); margin-bottom: 24px; }

	.list { display: flex; flex-direction: column; gap: 16px; }

	.spa-card {
		display: flex;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		overflow: hidden;
	}
	.spa-card__img-wrap { position: relative; width: 150px; flex-shrink: 0; }
	.spa-card__img { width: 100%; height: 100%; object-fit: cover; display: block; }
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
	.spa-card__body { padding: 16px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
	.spa-card__header { display: flex; align-items: center; gap: 8px; }
	.spa-card__name { font-size: 17px; font-weight: 700; }
	.price-range { font-size: 13px; font-weight: 700; color: var(--color-primary); }
	.spa-type { font-size: 12px; color: var(--color-text-muted); font-weight: 600; }
	.spa-card__desc { font-size: 13px; color: var(--color-text-muted); flex: 1; line-height: 1.5; }
	.meta-row { display: flex; gap: 16px; flex-wrap: wrap; }
	.meta-item { font-size: 12px; color: var(--color-text-muted); }
	.tags { display: flex; gap: 6px; flex-wrap: wrap; }
	.tag-chip {
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
