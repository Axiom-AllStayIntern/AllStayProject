import type { LocalizedString } from './menu.js';

export interface Restaurant {
	id: string;
	name: LocalizedString;
	description: LocalizedString;
	cuisine: string;
	openHours: string;
	imageUrl?: string;
	isOpen: boolean;
}

export interface TableAvailability {
	restaurantId: string;
	date: string;
	time: string;
	partySize: number;
	isAvailable: boolean;
}

export interface ReserveTableRequest {
	restaurantId: string;
	roomId: string;
	date: string;
	time: string;
	partySize: number;
	dietaryRequirements?: string;
	notes?: string;
}

export interface TableReservation {
	id: string;
	restaurantId: string;
	roomId: string;
	date: string;
	time: string;
	partySize: number;
	status: 'confirmed' | 'cancelled';
	confirmationCode: string;
}
