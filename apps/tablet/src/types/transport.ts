export type TransportType = 'car' | 'van' | 'shuttle' | 'motorbike';

export interface TransportOption {
	id: string;
	type: TransportType;
	name: string;
	description: string;
	capacity: number;
	price: number; // IDR
	imageUrl?: string;
}

export interface BookTransportRequest {
	optionId: string;
	roomId: string;
	pickupDate: string; // YYYY-MM-DD
	pickupTime: string; // HH:MM
	pickupLocation: string;
	destination: string;
	passengerCount: number;
	flightNumber?: string;
	notes?: string;
}

export interface TransportBooking {
	id: string;
	optionId: string;
	roomId: string;
	pickupDate: string;
	pickupTime: string;
	pickupLocation: string;
	destination: string;
	status: 'confirmed' | 'cancelled';
	confirmationCode: string;
	driverName?: string;
	driverPhone?: string;
}
