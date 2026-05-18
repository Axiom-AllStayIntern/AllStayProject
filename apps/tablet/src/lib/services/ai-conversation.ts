import { get } from 'svelte/store';
import { roomNumber } from '$lib/stores/room.js';

export interface AIResponse {
	text: string;
	action: {
		type: 'navigate';
		payload: {
			route: string;
			params?: Record<string, string>;
		};
	} | null;
	confidence: number;
}

// Maps orchestrator intents to app routes
const INTENT_ROUTES: Record<string, string> = {
	order: '/dining',
	booking_spa: '/spa',
	booking_restaurant: '/restaurants',
	booking_transport: '/explore',
};

export async function processVoiceInput(audioBlob: Blob): Promise<AIResponse> {
	// Step 1: Transcribe audio via Whisper
	const formData = new FormData();
	formData.append('audio', audioBlob, 'recording.webm');

	const sttRes = await fetch('/api/stt', { method: 'POST', body: formData });
	if (!sttRes.ok) {
		const err = await sttRes.json().catch(() => ({}));
		throw new Error((err as { message?: string }).message ?? 'Speech recognition failed');
	}
	const { text } = (await sttRes.json()) as { text: string };

	// Step 2: Parse intent via existing orchestrator
	const roomId = get(roomNumber) ?? 'guest';
	const convRes = await fetch('/api/conversation', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message: text, roomId, language: 'zh' })
	});
	if (!convRes.ok) throw new Error('AI service unavailable');

	const { reply, intent } = (await convRes.json()) as { reply: string; intent?: string };

	const route = intent ? INTENT_ROUTES[intent] : undefined;

	return {
		text: reply,
		action: route ? { type: 'navigate', payload: { route } } : null,
		confidence: route ? 0.92 : intent === 'info' ? 0.65 : 0.35
	};
}
