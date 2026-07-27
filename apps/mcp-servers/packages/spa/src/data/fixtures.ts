// Mock spa catalogue for AllStay (Bali resort).
// This is placeholder data standing in for the real Cakrasoft PMS.
// Keep the SHAPE stable; only the source (mock vs DB) should change behind SpaRepo.

export type SpaCategory = 'massage' | 'facial' | 'body' | 'package';

export interface SpaService {
	id: string;
	nameEn: string;
	nameZh: string;
	nameId: string; // Bahasa Indonesia — used by the staff side / Indonesian guests
	category: SpaCategory;
	durationMin: number;
	priceIdr: number;
	descEn: string;
	descZh: string;
	/** Plain-language flags the constraint layer / agent can reason over. */
	contraindications: string[];
	maxPartySize: number;
}

export const SPA_SERVICES: SpaService[] = [
	{
		id: 'balinese-massage',
		nameEn: 'Traditional Balinese Massage',
		nameZh: '传统巴厘按摩',
		nameId: 'Pijat Bali Tradisional',
		category: 'massage',
		durationMin: 90,
		priceIdr: 650_000,
		descEn: 'A full-body massage combining acupressure, gentle stretching and aromatherapy oils to relieve tension.',
		descZh: '结合指压、轻柔拉伸与芳疗精油的全身按摩，舒缓疲劳与紧绷。',
		contraindications: ['recent injury or surgery'],
		maxPartySize: 1
	},
	{
		id: 'aromatherapy',
		nameEn: 'Aromatherapy Massage',
		nameZh: '芳香精油按摩',
		nameId: 'Pijat Aromaterapi',
		category: 'massage',
		durationMin: 60,
		priceIdr: 550_000,
		descEn: 'A relaxing massage using essential-oil blends chosen for calming or energising effect.',
		descZh: '使用可安神或提振的精油配方进行的放松按摩。',
		contraindications: ['essential-oil allergy'],
		maxPartySize: 1
	},
	{
		id: 'hot-stone',
		nameEn: 'Hot Stone Therapy',
		nameZh: '热石理疗',
		nameId: 'Terapi Batu Panas',
		category: 'massage',
		durationMin: 90,
		priceIdr: 750_000,
		descEn: 'Heated volcanic stones placed along the body to melt deep muscular tension.',
		descZh: '将加热的火山石置于身体，深层化解肌肉紧张。',
		contraindications: ['pregnancy', 'high blood pressure', 'diabetes'],
		maxPartySize: 1
	},
	{
		id: 'tropical-facial',
		nameEn: 'Tropical Radiance Facial',
		nameZh: '热带焕采面部护理',
		nameId: 'Perawatan Wajah Tropis',
		category: 'facial',
		durationMin: 60,
		priceIdr: 600_000,
		descEn: 'A brightening facial with tropical fruit enzymes and hydrating mask.',
		descZh: '采用热带果酶与保湿面膜的提亮面部护理。',
		contraindications: ['active skin infection'],
		maxPartySize: 1
	},
	{
		id: 'body-scrub',
		nameEn: 'Balinese Boreh Body Scrub',
		nameZh: '巴厘 Boreh 身体磨砂',
		nameId: 'Lulur Boreh Bali',
		category: 'body',
		durationMin: 45,
		priceIdr: 450_000,
		descEn: 'A traditional spiced body scrub that exfoliates and warms the skin.',
		descZh: '传统香料身体磨砂，去角质并温暖肌肤。',
		contraindications: ['sensitive skin', 'sunburn'],
		maxPartySize: 1
	},
	{
		id: 'couple-retreat',
		nameEn: "Couple's Sanctuary Retreat",
		nameZh: '双人静心套餐',
		nameId: 'Paket Retret Pasangan',
		category: 'package',
		durationMin: 120,
		priceIdr: 1_800_000,
		descEn: 'A side-by-side massage and flower bath experience for two in a private villa.',
		descZh: '私人别墅内的双人并排按摩与花瓣浴体验。',
		contraindications: [],
		maxPartySize: 2
	}
];
