import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		services: [
			{
				id: 'sp-bali',
				glyph: 'leaf',
				imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=320&auto=format&fit=crop',
				name: { en: 'Balinese Massage', zh: '巴厘式按摩' },
				description: { en: 'Traditional full-body massage using long strokes and aromatic oils.', zh: '经典全身按摩，长按推拿配合芳香精油。' },
				duration: 60,
				price: 550000,
				isAvailable: true
			},
			{
				id: 'sp-hot',
				glyph: 'stone',
				imageUrl: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=320&auto=format&fit=crop',
				name: { en: 'Hot Stone Therapy', zh: '热石疗法' },
				description: { en: 'Heated volcanic stones to ease deep muscle tension.', zh: '火山热石舒缓深层肌肉紧绷。' },
				duration: 75,
				price: 780000,
				isAvailable: true
			},
			{
				id: 'sp-flora',
				glyph: 'flower',
				imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=320&auto=format&fit=crop',
				name: { en: 'Floral Bath Ritual', zh: '花浴仪式' },
				description: { en: 'Frangipani and rose petal bath with herbal infusion.', zh: '鸡蛋花与玫瑰花瓣浴，搭配草本浸泡。' },
				duration: 45,
				price: 420000,
				isAvailable: true
			},
			{
				id: 'sp-foot',
				glyph: 'foot',
				imageUrl: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=320&auto=format&fit=crop',
				name: { en: 'Reflexology', zh: '足底反射疗法' },
				description: { en: 'Acupressure on the soles to restore body balance.', zh: '足底穴位按压，调和身体平衡。' },
				duration: 45,
				price: 380000,
				isAvailable: true
			},
			{
				id: 'sp-couple',
				glyph: 'hearts',
				imageUrl: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=320&auto=format&fit=crop',
				name: { en: 'Couples Retreat', zh: '双人疗愈' },
				description: { en: 'Side-by-side massage and floral bath in a private suite.', zh: '双人并肩按摩并享私密花浴套房。' },
				duration: 120,
				price: 1850000,
				isAvailable: true
			}
		]
	};
};
