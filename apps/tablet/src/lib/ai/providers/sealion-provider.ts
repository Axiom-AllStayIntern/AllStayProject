// SEA-LION / Sahabat-AI provider — native Bahasa Indonesia phrasing.
//
// SEA-LION (AI Singapore) exposes an OpenAI-COMPATIBLE API, so we reuse the
// `openai` SDK — only the baseURL + key change. Sahabat-AI (GoTo, Indonesian-
// tuned on SEA-LION) can be served the same way (self-hosted vLLM/TGI, or a
// compatible endpoint) by pointing SEALION_BASE_URL/SEALION_MODEL at it.
//
// This provider advertises ONLY 'native_id' — it deliberately does NOT get
// tool_use. Its single job is to re-voice already-decided content in idiomatic
// Indonesian; all reasoning/tool decisions stay on Claude.
//
// Config (env) — leave the key blank until you have one:
//   SEALION_BASE_URL   default https://api.sea-lion.ai/v1
//   SEALION_API_KEY    create at https://playground.sea-lion.ai (Google sign-in)
//   SEALION_MODEL      default aisingapore/Gemma-SEA-LION-v4-27B-IT
//   SEALION_THINKING   "off" to disable reasoning traces on -R models (latency)
//
// Note: the public SEA-LION API is rate-limited (~10 req/min per key as of
// 2026-06); for eval sweeps use EVAL_DELAY_MS (see the runner) or self-host.

import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import type { LlmProvider, GenerateResult } from './provider.js';

export const SEALION_DEFAULT_BASE_URL = 'https://api.sea-lion.ai/v1';
// An instruct model the hosted API serves (verify with scripts/check-sealion.ts).
// For Indonesian slang/register, Sahabat-AI (GoTo, SEA-LION-based) is a strong
// self-hosted alternative — just set SEALION_BASE_URL/SEALION_MODEL to it.
export const SEALION_DEFAULT_MODEL = 'aisingapore/Qwen-SEA-LION-v4.5-27B-IT';

let _client: OpenAI | null = null;

export function sealionBaseUrl(): string {
	return env.SEALION_BASE_URL ?? SEALION_DEFAULT_BASE_URL;
}
export function sealionModel(): string {
	return env.SEALION_MODEL ?? SEALION_DEFAULT_MODEL;
}
/** True only when a key is configured — callers should route away otherwise. */
export function sealionConfigured(): boolean {
	return !!(env.SEALION_API_KEY && env.SEALION_API_KEY !== 'your_sealion_api_key_here');
}

function client(): OpenAI {
	if (!_client) {
		_client = new OpenAI({
			apiKey: env.SEALION_API_KEY ?? 'not-set',
			baseURL: sealionBaseUrl()
		});
	}
	return _client;
}

export const sealionProvider: LlmProvider = {
	id: 'sealion',
	capabilities: new Set(['native_id']),
	async generate(req): Promise<GenerateResult> {
		const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
		if (req.system) messages.push({ role: 'system', content: req.system });
		for (const m of req.messages) {
			messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
		}

		// SEA-LION reasoning (-R) models emit <think> traces by default; turn them
		// off for a phrasing task. Passed through as an OpenAI-compatible extra field.
		const extra: Record<string, unknown> = {};
		if ((env.SEALION_THINKING ?? '').toLowerCase() === 'off' || /-R\b/i.test(sealionModel())) {
			extra.chat_template_kwargs = { thinking_mode: 'off' };
		}

		const res = await client().chat.completions.create({
			model: sealionModel(),
			messages,
			max_tokens: req.maxTokens ?? 1024,
			temperature: req.temperature ?? 0.6,
			...extra
		} as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming);

		const text = res.choices?.[0]?.message?.content?.trim() ?? '';
		return { text, stopReason: 'end', raw: res };
	}
};

/** List models available to the configured key (used by the connectivity check). */
export async function listSealionModels(): Promise<string[]> {
	const res = await client().models.list();
	return res.data.map((m) => m.id);
}
