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
	order:               '/dining',
	checkout:            '/cart',
	spa_info:            '/spa',
	booking_spa:         '/spa',
	booking_restaurant:  '/restaurants',
	booking_transport:   '/explore'
};

export async function processVoiceInput(
	audioBlob: Blob,
	_hint: 'en' | 'zh' | 'id' = 'zh',
	onReplyChunk?: (partial: string) => void   // called with cumulative reply as it streams
): Promise<AIResponse> {
	// ── 1. Speech-to-text (Whisper auto-detects language) ────────────────────
	const formData = new FormData();
	formData.append('audio', audioBlob, 'recording.webm');

	const sttRes = await fetch('/api/stt', { method: 'POST', body: formData });
	if (!sttRes.ok) {
		const err = await sttRes.json().catch(() => ({}));
		throw new Error((err as { message?: string }).message ?? 'Speech recognition failed');
	}
	const { text: userText, detected } = (await sttRes.json()) as { text: string; detected: 'en' | 'zh' | 'id' };

	// Auto-switch UI language to match what the user spoke
	const currentLang = get(languageStore);
	if (detected !== currentLang) languageStore.set(detected);
	const language = detected;

	conversationHistory.addTurn({ role: 'user', content: userText });

	// ── 2. Intent + conversation (SSE stream) ─────────────────────────────────
	const roomId  = get(roomNumber) ?? 'guest';
	const history = get(conversationHistory).slice(0, -1);

	const convRes = await fetch('/api/conversation', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message: userText, roomId, language, history })
	});
	if (!convRes.ok || !convRes.body) throw new Error('AI service unavailable');

	// Read SSE stream
	const reader  = convRes.body.getReader();
	const decoder = new TextDecoder();
	let sseBuffer  = '';
	let replyAccum = '';
	let reply      = '';
	let intent: string | undefined;
	let data: unknown;

	outer: while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		sseBuffer += decoder.decode(value, { stream: true });
		const lines = sseBuffer.split('\n');
		sseBuffer = lines.pop() ?? '';   // keep incomplete last line

		for (const line of lines) {
			if (!line.startsWith('data: ')) continue;
			let event: Record<string, unknown>;
			try { event = JSON.parse(line.slice(6)); }
			catch { continue; }

			if (event.t === 'chunk') {
				replyAccum += event.v as string;
				onReplyChunk?.(replyAccum);
			} else if (event.t === 'done') {
				reply  = event.reply  as string ?? replyAccum;
				intent = event.intent as string | undefined;
				data   = event.data;
				break outer;
			} else if (event.t === 'error') {
				throw new Error((event.message as string) ?? 'AI service error');
			}
		}
	}

	conversationHistory.addTurn({ role: 'assistant', content: reply });

	// ── 3. Build AIResponse ───────────────────────────────────────────────────
	if (intent === 'close_conversation') {
		return { text: reply, action: { type: 'close_session' }, confidence: 0.95 };
	}

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
		action: shouldNavigate ? { type: 'navigate', payload: { route: targetRoute! } } : null,
		confidence: targetRoute ? 0.92 : intent === 'info' ? 0.65 : 0.35,
		agentData: data ?? undefined
	};
}
