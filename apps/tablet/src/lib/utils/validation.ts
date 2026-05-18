export function isValidRoomNumber(room: string): boolean {
	return /^\d{3,4}$/.test(room.trim());
}

export function isValidStaffPin(pin: string): boolean {
	return /^\d{4,6}$/.test(pin.trim());
}

export function isValidDate(dateStr: string): boolean {
	const date = new Date(dateStr);
	return !isNaN(date.getTime()) && date >= new Date();
}

export function isValidTime(timeStr: string): boolean {
	return /^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr);
}
