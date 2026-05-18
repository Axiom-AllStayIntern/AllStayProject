export interface LocalizedString {
	en: string;
	zh: string;
}

export interface MenuItem {
	id: string;
	categoryId: string;
	name: LocalizedString;
	description: LocalizedString;
	price: number; // IDR
	imageUrl?: string;
	isAvailable: boolean;
	tags?: string[];
}

export interface MenuCategory {
	id: string;
	name: LocalizedString;
	imageUrl?: string;
	items?: MenuItem[];
}

export interface MenuResponse {
	categories: MenuCategory[];
}
