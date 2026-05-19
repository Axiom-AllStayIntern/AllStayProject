import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import { handleOrderIntent } from './agents/order-agent.js';
import { handleBookingIntent } from './agents/booking-agent.js';
import { handleInfoIntent } from './agents/info-agent.js';

export interface ConversationInput {
	message: string;
	roomId: string;
	language: 'en' | 'zh';
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

Analyze the guest's message and respond with ONLY a raw JSON object — no markdown, no code fences, no explanation outside the JSON.

Response schema:
{
  "intent": "order" | "cancel_order" | "booking_spa" | "booking_restaurant" | "booking_transport" | "info" | "switch_language" | "close_conversation" | "other",
  "entities": {
    "dish": string | null,
    "quantity": number | null,
    "specialInstructions": string | null,
    "serviceId": string | null,
    "date": string | null,
    "time": string | null,
    "partySize": number | null,
    "notes": string | null,
    "query": string | null,
    "foodTag": "noodles" | "rice" | "sandwich" | "sweet" | "fruit" | "drinks" | null
  },
  "reply": "Your warm, concise conversational response in the same language as the guest"
}

Rules:
- reply must be short (1–2 sentences), friendly, and in the guest's language
- Use "order" intent whenever the guest asks about food/drinks in any way: ordering, browsing, asking for recommendations, asking what's good, asking what's available, or any food-related curiosity ("有什么推荐", "推荐一下", "what do you recommend", "what's good", "what's on the menu", "I'm hungry", "我饿了", "有什么好吃的", etc.). These are all order intents with no specific dish.
- For order intent with no specific dish: reply should invite the guest to browse the menu and naturally recommend a top pick, do NOT ask for a dish name
- foodTag: set when the guest mentions a food category without naming a specific dish. Values: "noodles" (面食/面条/noodles), "rice" (米饭/炒饭/rice), "sandwich" (三明治/sandwich), "sweet" (甜点/松饼/pancake/dessert), "fruit" (水果/fruit), "drinks" (饮品/饮料/drinks/beverage). Leave null if a specific dish is named or the category is unclear.
- When foodTag is set and no specific dish, naturally recommend the top pick for that category in your reply. Always include a chef's endorsement phrase (e.g. "这也是我们主厨的私人推荐" / "our head chef personally recommends this one"). Top picks: noodles→Mie Aceh/亚齐香料面 (new arrival, **limited-time 20% off / 8折优惠**, mention the discount naturally), rice→Nasi Goreng/印尼炒饭, sandwich→Club Sandwich/俱乐部三明治, sweet→Pancake Stack/松饼塔, fruit→Tropical Fruit Platter/热带水果拼盘, drinks→Fresh Coconut Water/鲜椰青
- Return ONLY the JSON object, nothing else
- Use "switch_language" when the guest explicitly requests a language change: "speak English", "说中文", "switch to Chinese", "用英文", "换成中文", "please speak Chinese", etc. Reply naturally in the requested language confirming the switch.
- Use "close_conversation" when the guest wants to end the conversation: says goodbye, "that's all", "thank you bye", "结束了", "再见", "谢谢，没了", etc.

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
	noodles:  'mie-aceh',   // newest featured noodle dish
	rice:     'nasi',
	sandwich: 'club',
	sweet:    'pkx',
	fruit:    'fruit',
	drinks:   'coco',
};

export async function processConversation(input: ConversationInput): Promise<ConversationOutput> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const messages: Anthropic.MessageParam[] = [
		...(input.history ?? []).map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		})),
		{ role: 'user', content: input.message }
	];

	const langNote = input.language === 'zh'
		? 'IMPORTANT: The guest is speaking Chinese. Your "reply" field MUST be in Chinese (Simplified). Do not use English.'
		: 'IMPORTANT: The guest is speaking English. Your "reply" field MUST be in English. Do not use Chinese.';

	const response = await client.messages.create({
		model: env.AI_MODEL ?? 'claude-sonnet-4-6',
		max_tokens: 1024,
		system: `${SYSTEM_PROMPT}\n\n${langNote}`,
		messages
	});

	const raw = response.content[0].type === 'text' ? response.content[0].text : '';
	// Strip markdown code fences Claude occasionally adds despite instructions
	const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

	let parsed: { intent: string; entities: Record<string, unknown>; reply: string };
	try {
		parsed = JSON.parse(text);
	} catch {
		return { reply: raw };
	}

	// Dispatch to appropriate agent
	switch (parsed.intent) {
		case 'cancel_order': {
			const dish = (parsed.entities.dish as string | null) ?? null;
			return {
				reply: parsed.reply,
				intent: 'cancel_order',
				data: { itemName: dish }   // null = cancel last item
			};
		}
		case 'order': {
			// No specific dish → navigate to menu with optional tag + recommendation
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
			// On success: Claude's contextual reply + agent's factual confirmation line
			// On failure: agent's error reply (Claude's reply may be incorrect at this point)
			const reply = result.success && result.confirmLine
				? `${parsed.reply}\n${result.confirmLine}`
				: (result.reply ?? parsed.reply);
			return { reply, intent: 'order', data: result.data };
		}
		case 'booking_spa': {
			const result = await handleBookingIntent({
				service: 'spa',
				serviceId: parsed.entities.serviceId as string,
				roomId: input.roomId,
				date: parsed.entities.date as string,
				time: parsed.entities.time as string,
				notes: parsed.entities.notes as string
			});
			return { reply: result.reply, intent: 'booking_spa', data: result.data };
		}
		case 'booking_restaurant': {
			const result = await handleBookingIntent({
				service: 'restaurant',
				serviceId: parsed.entities.serviceId as string,
				roomId: input.roomId,
				date: parsed.entities.date as string,
				time: parsed.entities.time as string,
				partySize: parsed.entities.partySize as number,
				notes: parsed.entities.notes as string
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
				notes: parsed.entities.notes as string
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
