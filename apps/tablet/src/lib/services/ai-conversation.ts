import { get } from 'svelte/store';
import { roomNumber } from '$lib/stores/room.js';
import { language as languageStore } from '$lib/stores/language.js';
import { conversationHistory } from '$lib/stores/conversation.js';

export interface AIResponse {
	text: string;
	action:
		| { type: 'navigate';    payload: { route: string; params?: Record<string, string> } }
		| { type: 'cart_remove'; payload: { itemName: string | null } }
		| { type: 'close_session' }
		| null;
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
	_hint: 'en' | 'zh' = 'zh'  // kept for API compat, actual lang comes from Whisper detection
): Promise<AIResponse> {
	// ── 1. Speech-to-text (Whisper auto-detects language) ────────────────────
	const formData = new FormData();
	formData.append('audio', audioBlob, 'recording.webm');

	const sttRes = await fetch('/api/stt', { method: 'POST', body: formData });
	if (!sttRes.ok) {
		const err = await sttRes.json().catch(() => ({}));
		throw new Error((err as { message?: string }).message ?? 'Speech recognition failed');
	}
	const { text: userText, detected } = (await sttRes.json()) as { text: string; detected: 'en' | 'zh' };

	// Auto-switch UI language to match what the user spoke
	const currentLang = get(languageStore);
	if (detected !== currentLang) {
		languageStore.set(detected);
	}
	const language = detected;

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

	if (intent === 'close_conversation') {
		return { text: reply, action: { type: 'close_session' }, confidence: 0.95 };
	}

	// Cart removal — handled client-side from the cart store
	if (intent === 'cancel_order') {
		const d = data as { itemName: string | null } | null;
		return {
			text: reply,
			action: { type: 'cart_remove', payload: { itemName: d?.itemName ?? null } },
			confidence: 0.95
		};
	}

	const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
	const baseRoute   = intent ? INTENT_ROUTES[intent] : undefined;
	const navData     = data as Record<string, string> | null;
	const tag         = navData?.tag;
	const recommend   = navData?.recommend;
	let targetRoute   = baseRoute;
	if (baseRoute && tag) {
		const qs = new URLSearchParams({ tag });
		if (recommend) qs.set('recommend', recommend);
		targetRoute = `${baseRoute}?${qs.toString()}`;
	}
	const shouldNavigate = targetRoute && (currentPath !== baseRoute || !!tag);

	return {
		text: reply,
		action: shouldNavigate ? { type: 'navigate', payload: { route: targetRoute } } : null,
		confidence: targetRoute ? 0.92 : intent === 'info' ? 0.65 : 0.35,
		agentData: data ?? undefined
	};
}
