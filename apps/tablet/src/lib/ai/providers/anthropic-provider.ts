// Anthropic (Claude) provider — the reasoning + tool-calling workhorse.
//
// Also the single place the Anthropic client is constructed, so orchestrator /
// spa-agent no longer `new Anthropic()` directly (centralized model + key).

import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';
import type { LlmProvider } from './provider.js';

let _client: Anthropic | null = null;

/** Shared Anthropic client (reused across calls). */
export function getAnthropic(): Anthropic {
	if (!_client) _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	return _client;
}

export function anthropicModel(): string {
	return env.AI_MODEL ?? 'claude-sonnet-4-6';
}

export const anthropicProvider: LlmProvider = {
	id: 'anthropic',
	capabilities: new Set(['tool_use', 'streaming', 'native_id']),
	async generate(req) {
		const res = await getAnthropic().messages.create({
			model: anthropicModel(),
			max_tokens: req.maxTokens ?? 1024,
			system: req.system,
			messages: req.messages
				.filter((m) => m.role !== 'system')
				.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
			...(req.temperature !== undefined ? { temperature: req.temperature } : {})
		});
		const text = res.content
			.filter((b): b is Anthropic.TextBlock => b.type === 'text')
			.map((b) => b.text)
			.join(' ')
			.trim();
		return { text, stopReason: res.stop_reason === 'max_tokens' ? 'length' : 'end', raw: res };
	}
};
