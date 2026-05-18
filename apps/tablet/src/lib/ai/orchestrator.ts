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
  "intent": "order" | "booking_spa" | "booking_restaurant" | "booking_transport" | "info" | "other",
  "entities": {
    "dish": string | null,
    "quantity": number | null,
    "specialInstructions": string | null,
    "serviceId": string | null,
    "date": string | null,
    "time": string | null,
    "partySize": number | null,
    "notes": string | null,
    "query": string | null
  },
  "reply": "Your warm, concise conversational response in the same language as the guest"
}

Rules:
- reply must be short (1–2 sentences), friendly, and in the guest's language
- For order intent with no specific dish: reply should invite the guest to browse the menu, do NOT ask for a dish name
- Return ONLY the JSON object, nothing else`;

export async function processConversation(input: ConversationInput): Promise<ConversationOutput> {
	const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	const messages: Anthropic.MessageParam[] = [
		...(input.history ?? []).map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		})),
		{ role: 'user', content: input.message }
	];

	const response = await client.messages.create({
		model: env.AI_MODEL ?? 'claude-sonnet-4-6',
		max_tokens: 1024,
		system: SYSTEM_PROMPT,
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
		case 'order': {
			// No specific dish → just navigate to the menu; agent only runs when a dish is named
			if (!parsed.entities.dish) {
				return { reply: parsed.reply, intent: 'order' };
			}
			const result = await handleOrderIntent({
				dish: parsed.entities.dish as string,
				rawMessage: input.message,
				quantity: parsed.entities.quantity as number,
				specialInstructions: parsed.entities.specialInstructions as string,
				roomId: input.roomId,
				language: input.language
			});
			return { reply: result.reply, intent: 'order', data: result.data };
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
		default:
			return { reply: parsed.reply, intent: parsed.intent };
	}
}
