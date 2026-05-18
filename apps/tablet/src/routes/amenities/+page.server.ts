import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		amenities: [
			{ icon: '🏊', name: 'Infinity Pool', hours: '7:00 AM – 10:00 PM' },
			{ icon: '🏋️', name: 'Fitness Center', hours: '6:00 AM – 10:00 PM' },
			{ icon: '🧘', name: 'Yoga Pavilion', hours: 'Classes at 7:00 AM & 5:00 PM' },
			{ icon: '🌿', name: 'Spa & Wellness', hours: '9:00 AM – 9:00 PM' },
			{ icon: '📚', name: 'Library Lounge', hours: 'Open 24 hours' },
			{ icon: '🍳', name: 'Breakfast', hours: '7:00 AM – 10:30 AM at The Garden' }
		]
	};
};
