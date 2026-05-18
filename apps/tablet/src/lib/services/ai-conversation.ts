import { get } from 'svelte/store';
import { roomNumber } from '$lib/stores/room.js';
import { conversationHistory } from '$lib/stores/conversation.js';

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
	/** Raw data returned by an agent (e.g. cart item after an order) */
	agentData?: unknown;
}

const INTENT_ROUTES: Record<string, string> = {
	order: '/dining',
	booking_spa: '/spa',
	booking_restaurant: '/restaurants',
	booking_transport: '/explore'
};

export async function processVoiceInput(
	audioBlob: Blob,
	language: 'en' | 'zh' = 'zh'
): Promise<AIResponse> {
	// ── 1. Speech-to-text ────────────────────────────────────────────────────
	const formData = new FormData();
	formData.append('audio', audioBlob, 'recording.webm');
	formData.append('language', language);

	const sttRes = await fetch('/api/stt', { method: 'POST', body: formData });
	if (!sttRes.ok) {
		const err = await sttRes.json().catch(() => ({}));
		throw new Error((err as { message?: string }).message ?? 'Speech recognition failed');
	}
	const { text: userText } = (await sttRes.json()) as { text: string };

	// Append user turn to history BEFORE calling conversation
	conversationHistory.addTurn({ role: 'user', content: userText });

	// ── 2. Intent + conversation ──────────────────────────────────────────────
	const roomId = get(roomNumber) ?? 'guest';
	const history = get(conversationHistory).slice(0, -1); // all turns except the one we just added

	const convRes = await fetch('/api/conversation', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message: userText, roomId, language, history })
	});
	if (!convRes.ok) throw new Error('AI service unavailable');

	const { reply, intent, data } = (await convRes.json()) as {
		reply: string;
		intent?: string;
		data?: unknown;
	};

	// Append assistant reply to history
	conversationHistory.addTurn({ role: 'assistant', content: reply });

	// ── 3. Build AIResponse ───────────────────────────────────────────────────
	const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
	const targetRoute = intent ? INTENT_ROUTES[intent] : undefined;

	// Navigate only if we aren't already on the target page
	const shouldNavigate = targetRoute && currentPath !== targetRoute;

	return {
		text: reply,
		action: shouldNavigate ? { type: 'navigate', payload: { route: targetRoute } } : null,
		confidence: targetRoute ? 0.92 : intent === 'info' ? 0.65 : 0.35,
		agentData: data ?? undefined
	};
}
