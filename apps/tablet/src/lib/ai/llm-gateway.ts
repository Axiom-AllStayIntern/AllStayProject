// LLM Gateway — routes each task to the right model, and runs the two-stage
// "reason in Claude, phrase in SEA-LION" localization with a verification gate.
//
// Routing principle:
//   • classify / tool_reasoning  → ALWAYS Claude (strong reasoning + tool-use)
//   • phrase / localize (id)     → SEA-LION / Sahabat-AI (native Bahasa),
//                                   otherwise Claude
//
// The phrase step never lets a weak model invent facts: Claude produces the
// draft (with all facts/numbers), SEA-LION only re-voices it, and a gate
// verifies the result kept the locked terminology and every number — falling
// back to Claude's draft if not. Controlled by PHRASE_MODEL=off|mock|sealion.

import { env } from '$env/dynamic/private';
import { buildCurationContext, type Lang, type GlossaryLock } from './curation/index.js';
import { anthropicProvider } from './providers/anthropic-provider.js';
import { sealionProvider, sealionConfigured } from './providers/sealion-provider.js';
import { mockProvider } from './providers/mock-provider.js';
import type { LlmProvider } from './providers/provider.js';

export type PhraseMode = 'off' | 'mock' | 'sealion';

export function phraseMode(): PhraseMode {
	const m = (env.PHRASE_MODEL ?? 'off').toLowerCase();
	return m === 'mock' || m === 'sealion' ? m : 'off';
}

export type Task = 'classify' | 'tool_reasoning' | 'phrase' | 'localize';

export interface RouteContext {
	language: Lang;
	task: Task;
	intent?: string;
	audience?: 'guest' | 'staff';
}

/** Decide which provider handles a task, with a human-readable reason (for logs/interview). */
export function route(ctx: RouteContext): { provider: LlmProvider; reason: string } {
	if (ctx.task === 'classify' || ctx.task === 'tool_reasoning') {
		return { provider: anthropicProvider, reason: 'reasoning/tool-use requires the strong model' };
	}
	// phrase / localize
	if (ctx.language === 'id' && phraseMode() !== 'off') {
		if (phraseMode() === 'sealion') {
			// Guard: sealion selected but no key → degrade to Claude's draft, don't error.
			if (!sealionConfigured()) {
				return { provider: anthropicProvider, reason: 'PHRASE_MODEL=sealion but SEALION_API_KEY unset → Claude draft' };
			}
			return { provider: sealionProvider, reason: 'native Bahasa phrasing via sealion' };
		}
		return { provider: mockProvider, reason: 'native Bahasa phrasing via mock (offline stand-in)' };
	}
	return { provider: anthropicProvider, reason: 'default to Claude (no id phrasing model active)' };
}

export interface PhraseInput {
	/** Claude's finished reply — the source of truth for facts/numbers. */
	draftReply: string;
	/** The guest utterance, used to retrieve the relevant glossary/culture. */
	query: string;
	lang: Lang;
	intent?: string;
}

export interface PhraseOutput {
	reply: string;
	/** provider id or "<id>->fallback" / "<id>->error-fallback". */
	via: string;
	/** true only if a phrasing model produced the reply and passed the gate. */
	phrased: boolean;
}

/** Two-stage localization. No-op unless lang==='id' and PHRASE_MODEL is active. */
export async function phraseReply(input: PhraseInput): Promise<PhraseOutput> {
	if (input.lang !== 'id' || phraseMode() === 'off' || !input.draftReply.trim()) {
		return { reply: input.draftReply, via: 'anthropic', phrased: false };
	}

	const { provider } = route({ language: 'id', task: 'phrase', intent: input.intent });
	if (provider.id === 'anthropic') {
		return { reply: input.draftReply, via: 'anthropic', phrased: false };
	}

	const curation = buildCurationContext({ query: input.query, lang: 'id', intent: input.intent });
	const system =
		`You are a native Bahasa Indonesia editor for a Bali resort concierge. ` +
		`Rephrase the DRAFT into warm, natural, polite Bahasa Indonesia (use Bapak/Ibu where natural). ` +
		`Rules: keep ALL facts, numbers, prices, dates and names EXACTLY as in the draft; ` +
		`do not add new information; keep proper nouns verbatim. Reply with ONLY the rephrased text.\n\n` +
		curation.systemFragment;

	try {
		const res = await provider.generate({
			system,
			messages: [{ role: 'user', content: `DRAFT: ${input.draftReply}` }],
			temperature: 0.5
		});
		const candidate = res.text.trim();
		if (candidate && passesGate(candidate, input.draftReply, curation.locks)) {
			return { reply: candidate, via: provider.id, phrased: true };
		}
		// Gate failed (dropped a locked term or a number) — trust Claude's draft.
		return { reply: input.draftReply, via: `${provider.id}->fallback`, phrased: false };
	} catch {
		return { reply: input.draftReply, via: `${provider.id}->error-fallback`, phrased: false };
	}
}

/** Verification gate: the rephrase must keep every locked term the draft used, and every number. */
function passesGate(candidate: string, draft: string, locks: GlossaryLock[]): boolean {
	const c = candidate.toLowerCase();
	const d = draft.toLowerCase();

	for (const lock of locks) {
		const term = lock.mustContain.toLowerCase();
		// Only enforce terms the draft actually used — don't demand unrelated terms.
		if (d.includes(term) && !c.includes(term)) return false;
	}

	const numbers = draft.match(/\d[\d.,:]*/g) ?? [];
	for (const n of numbers) {
		if (!candidate.includes(n)) return false;
	}
	return true;
}
