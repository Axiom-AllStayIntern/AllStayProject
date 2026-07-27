const IDR_FORMATTER = new Intl.NumberFormat('id-ID', {
	style: 'currency',
	currency: 'IDR',
	minimumFractionDigits: 0
});

export function formatPrice(amount: number): string {
	return IDR_FORMATTER.format(amount);
}

export function formatDate(dateStr: string, locale = 'en-US'): string {
	return new Date(dateStr).toLocaleDateString(locale, {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

export function formatTime(timeStr: string): string {
	const [h, m] = timeStr.split(':').map(Number);
	const date = new Date();
	date.setHours(h, m);
	return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
