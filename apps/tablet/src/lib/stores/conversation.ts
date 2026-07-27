import { writable } from 'svelte/store';

export interface ConversationTurn {
	role: 'user' | 'assistant';
	content: string;
}

function createConversationStore() {
	const { subscribe, update, set } = writable<ConversationTurn[]>([]);

	return {
		subscribe,
		addTurn(turn: ConversationTurn) {
			// Keep at most 10 turns (5 exchanges) — avoids token bloat
			update((h) => [...h.slice(-9), turn]);
		},
		clear: () => set([])
	};
}

export const conversationHistory = createConversationStore();
