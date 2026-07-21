import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { handleOrderIntent } from './agents/order-agent.js';
import { handleBookingIntent, proposeSpaBooking, confirmSpaBooking } from './agents/booking-agent.js';
import { handleInfoIntent } from './agents/info-agent.js';
import { runSpaConcierge, resolveSpaServiceId } from './agents/spa-agent.js';
import { spaSession } from './spa-session.js';

export interface ConversationInput {
	message: string;
	roomId: string;
	language: 'en' | 'zh' | 'id';
	history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ConversationOutput {
	reply: string;
	intent?: string;
	data?: unknown;
}

const SYSTEM_PROMPT = `You are AllStay, a helpful hotel concierge assistant for a luxury resort in Bali.
You help guests with:
1. Room dining orders (food and drinks)
2. Spa bookings
3. Restaurant reservations
4. Transport arrangements
5. General hotel information

Analyze the guest's message and answer by calling the "respond" tool. Provide:
- intent: one of order, cancel_order, checkout, spa_info, booking_spa, confirm_booking, booking_restaurant, booking_transport, info, switch_language, close_conversation, other
- entities: extracted fields (dish, quantity, specialInstructions, serviceId, date, time, partySize, notes, query, foodTag ["noodles"|"rice"|"sandwich"|"sweet"|"fruit"|"drinks"]). Use null when a field is not present.
- reply: your warm, concise conversational response in the same language as the guest

Always call the respond tool — do not answer in plain text.

Rules:
- reply must be short (1–2 sentences), friendly, and in the guest's language
- Use "order" intent whenever the guest asks about food/drinks in any way: ordering, browsing, asking for recommendations, asking what's good, asking what's available, or any food-related curiosity ("有什么推荐", "推荐一下", "what do you recommend", "what's good", "what's on the menu", "I'm hungry", "我饿了", "有什么好吃的", etc.). These are all order intents with no specific dish.
- For order intent with no specific dish: reply should invite the guest to browse the menu and naturally recommend a top pick, do NOT ask for a dish name
- foodTag: set when the guest mentions a food category without naming a specific dish. Values: "noodles" (面食/面条/noodles), "rice" (米饭/炒饭/rice), "sandwich" (三明治/sandwich), "sweet" (甜点/松饼/pancake/dessert), "fruit" (水果/fruit), "drinks" (饮品/饮料/drinks/beverage). Leave null if a specific dish is named or the category is unclear.
- When foodTag is set and no specific dish, naturally recommend the top pick for that category in your reply. Always include a chef's endorsement phrase (e.g. "这也是我们主厨的私人推荐" / "our head chef personally recommends this one"). Top picks: noodles→Mie Aceh/亚齐香料面 (new arrival, **limited-time 20% off / 8折优惠**, mention the discount naturally), rice→Nasi Goreng/印尼炒饭, sandwich→Club Sandwich/俱乐部三明治, sweet→Pancake Stack/松饼塔, fruit→Tropical Fruit Platter/热带水果拼盘, drinks→Fresh Coconut Water/鲜椰青
- Return ONLY the JSON object, nothing else
- Use "switch_language" when the guest explicitly requests a language change: "speak English", "说中文", "switch to Chinese", "用英文", "换成中文", "please speak Chinese", etc. Reply naturally in the requested language confirming the switch.
- Use "checkout" when the guest wants to place/submit their order, go to cart, or confirm their selections: "下单", "结账", "去购物车", "提交订单", "place my order", "go to cart", "checkout", "confirm order", "I'm done ordering", "that's all for food", "可以下单了", "帮我结算" etc. Reply in the guest's language reminding them they'll need to manually confirm on the next screen.
- Use "close_conversation" when the guest wants to end the conversation: says goodbye, "that's all", "thank you bye", "结束了", "再见", "谢谢，没了", etc.
- Use "spa_info" when the guest asks about spa treatments in an exploratory way: recommendations, what treatments/massages are available, prices, durations, or descriptions ("推荐个 SPA", "有什么按摩", "spa recommendation", "what massages do you have", "介绍下你们的 spa"). Set entities.query to the guest's request. Keep your "reply" a brief one-line acknowledgement (e.g. "Let me find the best option for you") — the detailed, data-grounded recommendation is produced separately, so do NOT invent treatment names or prices here.
- Use "booking_spa" only when the guest clearly wants to reserve a specific spa treatment (mentions booking/reserving, or names a treatment together with a date/time). Put the treatment name (free text is fine) in entities.serviceId, and the date/time in entities.date / entities.time. If the guest refers back to a previous recommendation ("book that one", "就订这个", "the one you mentioned"), still use booking_spa and leave entities.serviceId null — the system remembers the last recommendation.
- Use "confirm_booking" when the guest affirms a pending spa booking the assistant just proposed: "yes", "confirm", "go ahead", "好的", "确认", "可以", "就这样", "对". Only use this as a short affirmation right after a "Shall I confirm?" style question.

cancel_order intent guide:
Use "cancel_order" when the guest wants to remove, cancel, or undo an item from their cart.
- "取消印尼炒面" / "remove the nasi goreng" → dish: "印尼炒面" / "Nasi Goreng"
- "刚才那个不要了" / "cancel the last one" / "never mind" → dish: null  (means last item)
- "把炒面去掉" / "delete the noodles" → dish: "炒面" / "noodles"
reply: a short confirmation in the guest's language that the item was removed.

specialInstructions extraction guide:
Capture ANY food preparation preference, dietary request, or customisation the guest mentions.
Preserve the original language of the instruction. Join multiple instructions with ", ".
Examples:
  "少辣"              → "少辣"
  "不要香菜"          → "不要香菜"
  "少辣，不要洋葱"   → "少辣，不要洋葱"
  "extra spicy"       → "extra spicy"
  "well done, no salt"→ "well done, no salt"
  "no ice"            → "no ice"
  "素食"              → "素食"
  (nothing mentioned) → null`;

const TAG_RECOMMENDATIONS: Record<string, string> = {
	noodles:  'mie-aceh',
	rice:     'nasi',
	sandwich: 'club',
	sweet:    'pkx',
	fruit:    'fruit',
	drinks:   'coco',
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

function buildMessages(input: ConversationInput): Anthropic.MessageParam[] {
	return [
		...(input.history ?? []).map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		})),
		{ role: 'user', content: input.message }
	];
}

function buildSystem(input: ConversationInput): string {
	const langNote =
		input.language === 'zh'
			? 'IMPORTANT: The guest is speaking Chinese. Your "reply" field MUST be in Chinese (Simplified).'
			: input.language === 'id'
				? 'IMPORTANT: The guest is speaking Indonesian. Your "reply" field MUST be in Bahasa Indonesia, warm and polite (use Bapak/Ibu where natural).'
				: 'IMPORTANT: The guest is speaking English. Your "reply" field MUST be in English.';
	return `${SYSTEM_PROMPT}\n\n${langNote}`;
}

async function dispatchParsed(
	parsed: { intent: string; entities: Record<string, unknown>; reply: string },
	input: ConversationInput
): Promise<ConversationOutput> {
	switch (parsed.intent) {
		case 'cancel_order': {
			const dish = (parsed.entities.dish as string | null) ?? null;
			return { reply: parsed.reply, intent: 'cancel_order', data: { itemName: dish } };
		}
		case 'checkout':
			return { reply: parsed.reply, intent: 'checkout' };
		case 'order': {
			if (!parsed.entities.dish) {
				const tag       = (parsed.entities.foodTag as string | null) ?? null;
				const recommend = tag ? (TAG_RECOMMENDATIONS[tag] ?? null) : null;
				return { reply: parsed.reply, intent: 'order', data: tag ? { tag, recommend } : undefined };
			}
			const si = parsed.entities.specialInstructions;
			const result = await handleOrderIntent({
				dish: parsed.entities.dish as string,
				rawMessage: input.message,
				quantity: parsed.entities.quantity as number ?? undefined,
				specialInstructions: si && si !== 'null' ? String(si) : undefined,
				roomId: input.roomId,
				language: input.language
			});
			const reply = result.success && result.confirmLine
				? `${parsed.reply}\n${result.confirmLine}`
				: (result.reply ?? parsed.reply);
			return { reply, intent: 'order', data: result.data };
		}
		case 'spa_info': {
			const result = await runSpaConcierge({
				message: input.message,
				language: input.language,
				history: input.history
			});
			// Remember what was recommended so the guest can say "book that one".
			const rec = result.recommendedServiceIds.at(-1);
			if (rec) spaSession.setLastRecommended(input.roomId, rec);
			return {
				reply: result.reply,
				intent: 'spa_info',
				data: { recommendedServiceIds: result.recommendedServiceIds }
			};
		}
		case 'booking_spa': {
			const roomId = input.roomId;
			const rawServiceId = (parsed.entities.serviceId as string | undefined) ?? undefined;
			const prev = spaSession.getPending(roomId);

			// Resolve treatment: explicit mention → free-text in message → last recommendation → pending.
			const resolvedId =
				(rawServiceId ? await resolveSpaServiceId(rawServiceId) : null) ??
				(await resolveSpaServiceId(input.message)) ??
				spaSession.getLastRecommended(roomId) ??
				prev?.serviceId ??
				undefined;

			// Merge the new date/time with anything already collected this session.
			const merged = spaSession.mergePending(roomId, {
				serviceId: resolvedId,
				date: (parsed.entities.date as string | undefined) ?? undefined,
				time: (parsed.entities.time as string | undefined) ?? undefined
			});

			const result = await proposeSpaBooking({
				service: 'spa',
				serviceId: merged.serviceId,
				date: merged.date,
				time: merged.time,
				roomId,
				notes: parsed.entities.notes as string,
				language: input.language
			});

			// If a concrete proposal was produced, mark it awaiting confirmation (the gate).
			const proposal = (result.data as { proposal?: { serviceId: string; date: string; time: string } } | undefined)
				?.proposal;
			if (proposal) spaSession.mergePending(roomId, { ...proposal, awaitingConfirmation: true });

			return { reply: result.reply, intent: 'booking_spa', data: result.data };
		}
		case 'confirm_booking': {
			const roomId = input.roomId;
			const p = spaSession.getPending(roomId);
			if (!p?.serviceId || !p.date || !p.time || !p.awaitingConfirmation) {
				// Nothing concrete to confirm — let the model's own reply stand.
				return { reply: parsed.reply, intent: 'confirm_booking' };
			}
			const result = await confirmSpaBooking({
				service: 'spa',
				serviceId: p.serviceId,
				date: p.date,
				time: p.time,
				roomId,
				language: input.language
			});
			if (result.success) spaSession.clearPending(roomId);
			return { reply: result.reply, intent: 'confirm_booking', data: result.data };
		}
		case 'booking_restaurant': {
			const result = await handleBookingIntent({
				service: 'restaurant',
				serviceId: parsed.entities.serviceId as string,
				roomId: input.roomId,
				date: parsed.entities.date as string,
				time: parsed.entities.time as string,
				partySize: parsed.entities.partySize as number,
				notes: parsed.entities.notes as string,
				language: input.language
			});
			return { reply: result.reply, intent: 'booking_restaurant', data: result.data };
		}
		case 'booking_transport': {
			const result = await handleBookingIntent({
				service: 'transport',
				serviceId: parsed.entities.serviceId as string,
				roomId: input.roomId,
				date: parsed.entities.date as string,
				time: parsed.entities.time as string,
				notes: parsed.entities.notes as string,
				language: input.language
			});
			return { reply: result.reply, intent: 'booking_transport', data: result.data };
		}
		case 'info': {
			const result = await handleInfoIntent({
				query: parsed.entities.query as string ?? input.message,
				language: input.language
			});
			return { reply: result.reply, intent: 'info' };
		}
		case 'switch_language':
			return { reply: parsed.reply, intent: 'switch_language' };
		case 'close_conversation':
			return { reply: parsed.reply, intent: 'close_conversation' };
		default:
			return { reply: parsed.reply, intent: parsed.intent };
	}
}

interface ParsedResponse {
	intent: string;
	entities: Record<string, unknown>;
	reply: string;
}

// Structured-output tool. Forcing tool_choice to this guarantees a valid,
// schema-shaped object — no more hand-parsing raw JSON text.
const RESPOND_TOOL: Anthropic.Tool = {
	name: 'respond',
	description: 'Return the classified intent, extracted entities, and the spoken reply to the guest.',
	input_schema: {
		type: 'object',
		properties: {
			intent: {
				type: 'string',
				enum: [
					'order', 'cancel_order', 'checkout', 'spa_info', 'booking_spa', 'confirm_booking',
					'booking_restaurant', 'booking_transport', 'info', 'switch_language',
					'close_conversation', 'other'
				]
			},
			entities: {
				type: 'object',
				description:
					'Extracted fields: dish, quantity, specialInstructions, serviceId, date, time, partySize, notes, query, foodTag. Omit or set null when not present.'
			},
			reply: { type: 'string', description: "Warm, concise reply in the guest's language." }
		},
		required: ['intent', 'reply']
	}
};

function fallbackReply(language: 'en' | 'zh' | 'id'): string {
	if (language === 'zh') return '抱歉，我没太听清，可以再说一次吗？';
	if (language === 'id') return 'Maaf, saya kurang menangkap — bisa diulang?';
	return "Sorry, I didn't quite catch that — could you say it again?";
}

// Pull the `respond` tool call out of a completed message's content blocks.
function extractRespond(content: Anthropic.ContentBlock[]): ParsedResponse | null {
	const block = content.find(
		(b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'respond'
	);
	if (!block) return null;
	const input = block.input as Partial<ParsedResponse> | undefined;
	if (!input || typeof input.intent !== 'string') return null;
	return {
		intent: input.intent,
		entities: (input.entities as Record<string, unknown>) ?? {},
		reply: typeof input.reply === 'string' ? input.reply : ''
	};
}

// Tolerant parse of the streamed tool-input JSON (valid once the stream completes).
function safeParseRespond(json: string): ParsedResponse | null {
	try {
		const o = JSON.parse(json);
		if (o && typeof o.intent === 'string') {
			return {
				intent: o.intent,
				entities: (o.entities as Record<string, unknown>) ?? {},
				reply: typeof o.reply === 'string' ? o.reply : ''
			};
		}
	} catch {
		/* incomplete / invalid */
	}
	return null;
}

// Extracts new characters from the "reply" field of a partially-streamed JSON string.
function extractReplyProgress(
	accumulated: string,
	lastLen: number
): { chars: string; newLen: number } {
	const keyMatch = accumulated.match(/"reply"\s*:\s*"/);
	if (!keyMatch || keyMatch.index === undefined) return { chars: '', newLen: lastLen };

	const start = keyMatch.index + keyMatch[0].length;
	let replyText = '';
	let i = start;
	while (i < accumulated.length) {
		const c = accumulated[i];
		if (c === '\\' && i + 1 < accumulated.length) {
			const esc = accumulated[i + 1];
			if      (esc === '"')  replyText += '"';
			else if (esc === 'n')  replyText += '\n';
			else if (esc === 't')  replyText += '\t';
			else if (esc === '\\') replyText += '\\';
			else                   replyText += esc;
			i += 2;
		} else if (c === '"') {
			break;
		} else {
			replyText += c;
			i++;
		}
	}

	if (replyText.length > lastLen) {
		return { chars: replyText.slice(lastLen), newLen: replyText.length };
	}
	return { chars: '', newLen: lastLen };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function processConversation(input: ConversationInput): Promise<ConversationOutput> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const response = await client.messages.create({
		model: env.AI_MODEL ?? 'claude-sonnet-4-6',
		max_tokens: 1024,
		system: buildSystem(input),
		messages: buildMessages(input),
		tools: [RESPOND_TOOL],
		tool_choice: { type: 'tool', name: 'respond' }
	});

	const parsed = extractRespond(response.content);
	if (!parsed) return { reply: fallbackReply(input.language) };
	return dispatchParsed(parsed, input);
}

/** Streaming variant — calls onReplyChunk with incremental reply text as Claude generates it.
 *  Returns the full ConversationOutput once the stream is complete and agents have run. */
export async function streamConversation(
	input: ConversationInput,
	onReplyChunk: (chunk: string) => void
): Promise<ConversationOutput> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	let toolJson = '';
	let lastReplyLen = 0;

	const stream = client.messages.stream({
		model: env.AI_MODEL ?? 'claude-sonnet-4-6',
		max_tokens: 1024,
		system: buildSystem(input),
		messages: buildMessages(input),
		tools: [RESPOND_TOOL],
		tool_choice: { type: 'tool', name: 'respond' }
	});

	// With tool_choice forced, the model streams the tool input as JSON deltas.
	// We accumulate it and extract the "reply" field incrementally for the UI.
	for await (const event of stream) {
		if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
			toolJson += event.delta.partial_json;
			const { chars, newLen } = extractReplyProgress(toolJson, lastReplyLen);
			if (chars) {
				onReplyChunk(chars);
				lastReplyLen = newLen;
			}
		}
	}

	// Prefer the tolerant parse of the accumulated tool JSON; fall back to the
	// SDK's finalised message; finally a friendly fallback (never dump raw text).
	let parsed = safeParseRespond(toolJson);
	if (!parsed) {
		try {
			const final = await stream.finalMessage();
			parsed = extractRespond(final.content);
		} catch {
			/* stream error already surfaced */
		}
	}
	if (!parsed) return { reply: fallbackReply(input.language) };
	return dispatchParsed(parsed, input);
}
