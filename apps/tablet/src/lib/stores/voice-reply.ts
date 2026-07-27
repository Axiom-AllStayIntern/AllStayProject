import { writable } from 'svelte/store';

export interface VoiceReply {
	message: string;
	intent: string | null;
}

function createVoiceReplyStore() {
	const { subscribe, set } = writable<VoiceReply | null>(null);
	return {
		subscribe,
		set: (reply: VoiceReply) => set(reply),
		clear: () => set(null)
	};
}

export const voiceReply = createVoiceReplyStore();
