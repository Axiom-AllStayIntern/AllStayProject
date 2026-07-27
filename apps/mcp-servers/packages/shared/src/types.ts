export interface DbConfig {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
}

export interface PrinterConfig {
	ip: string;
	port: number;
}

export interface OrderPrintData {
	orderId: string;
	roomId: string;
	items: Array<{ name: string; quantity: number; price: number; specialInstructions?: string }>;
	total: number;
	timestamp: string;
}
