import { writable, derived } from 'svelte/store';

interface RoomState {
	roomNumber: string | null;
	checkInTime: number | null; // Unix timestamp
}

function createRoomStore() {
	const { subscribe, set, update } = writable<RoomState>({
		roomNumber: null,
		checkInTime: null
	});

	return {
		subscribe,
		setRoom(roomNumber: string) {
			update((s) => ({ ...s, roomNumber, checkInTime: Date.now() }));
			// TODO: persist to Capacitor Preferences
		},
		clearRoom() {
			set({ roomNumber: null, checkInTime: null });
		}
	};
}

export const room = createRoomStore();
export const roomNumber = derived(room, ($room) => $room.roomNumber);
