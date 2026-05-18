import type { LocalizedString } from './menu.js';

export interface SpaService {
	id: string;
	name: LocalizedString;
	description: LocalizedString;
	duration: number; // minutes
	price: number; // IDR
	imageUrl?: string;
	isAvailable: boolean;
}

export interface SpaTimeSlot {
	time: string; // HH:MM
	isAvailable: boolean;
	therapistId?: string;
}

export interface SpaAvailability {
	serviceId: string;
	date: string; // YYYY-MM-DD
	slots: SpaTimeSlot[];
}

export interface CreateSpaBookingRequest {
	serviceId: string;
	roomId: string;
	date: string;
	time: string;
	therapistGenderPreference?: 'male' | 'female' | 'no_preference';
	notes?: string;
}

export interface SpaBooking {
	id: string;
	serviceId: string;
	roomId: string;
	date: string;
	time: string;
	status: 'confirmed' | 'cancelled';
	confirmationCode: string;
}
