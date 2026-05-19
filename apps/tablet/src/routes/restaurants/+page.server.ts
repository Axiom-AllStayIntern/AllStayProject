import type { PageServerLoad } from './$types';

function isOpen(from: number, to: number): boolean {
	const now = new Date();
	const h = now.getHours() + now.getMinutes() / 60;
	if (to > 24) return h >= from || h <= (to - 24);
	return h >= from && h <= to;
}

export const load: PageServerLoad = async () => {
	return {
		restaurants: [
			{
				id: 'v-pavilion',
				cover: 'v1',
				label: 'PAVILION · GARDEN VIEW',
				imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop',
				name: { en: 'The Pavilion', zh: '亭阁餐厅' },
				cuisine: { en: 'All-day International', zh: '全日国际料理' },
				description: { en: 'Open kitchen, garden view, daily breakfast buffet.', zh: '开放式厨房，花园景观，每日自助早餐。' },
				openHours: '06:30 – 22:30',
				openFrom: 6.5,
				openTo: 22.5,
				isOpen: isOpen(6.5, 22.5)
			},
			{
				id: 'v-sakura',
				cover: 'v2',
				label: 'SAKURA · OMAKASE',
				imageUrl: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&auto=format&fit=crop',
				name: { en: 'Sakura Omakase', zh: '樱·主厨之选' },
				cuisine: { en: 'Japanese · Kaiseki', zh: '日式·怀石' },
				description: { en: '12-course chef\'s tasting · sushi counter for 8.', zh: '12 道主厨品鉴 · 8 席板前寿司。' },
				openHours: '18:00 – 23:00',
				openFrom: 18,
				openTo: 23,
				isOpen: isOpen(18, 23)
			},
			{
				id: 'v-sunset',
				cover: 'v3',
				label: 'SUNSET BAR · CLIFFSIDE',
				imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop',
				name: { en: 'Sunset Bar', zh: '日落酒廊' },
				cuisine: { en: 'Cocktails & Small Plates', zh: '鸡尾酒与小食' },
				description: { en: 'Cliff-edge perch, signature smoked old fashioned, live DJ Fri/Sat.', zh: '悬崖之巅，招牌烟熏老式鸡尾酒，每周五六现场 DJ。' },
				openHours: '16:00 – 01:00',
				openFrom: 16,
				openTo: 25,
				isOpen: isOpen(16, 25)
			}
		]
	};
};
