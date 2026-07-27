// Curation façade — one call assembles the full localization context.
//
// Layers, in order of "how the concierge speaks":
//   L1  register    — tone/honorifics/sensitivity (base, always on)
//   L2  cultural KB — retrieved grounded facts (Nyepi, halal, canang sari …)
//   L2+ glossary    — canonical terminology + machine-checkable locks
//   L2+ few-shot    — living examples of the voice (Bahasa)
//
// This is what separates the project from a generic "translation agent":
// curated corpus + terminology locking, injected consistently, and (via the
// returned locks) VERIFIABLE downstream by the LLM gateway's phrase gate.

import { env } from '$env/dynamic/private';
import { culturalRegister } from '../cultural/cultural-register.js';
import {
	retrieveCulturalFacts,
	renderCulturalFacts,
	type CulturalFact
} from '../cultural/cultural-kb.js';
import {
	selectGlossary,
	renderGlossary,
	buildGlossaryLocks,
	type GlossaryTerm,
	type GlossaryLock,
	type GlossaryDomain,
	type Lang
} from './glossary.js';
import { fewShotsFromFacts, renderFewShots, selectFewShots } from './fewshot.js';

export type { Lang, GlossaryLock } from './glossary.js';

export interface CurationInput {
	query: string;
	lang: Lang;
	domain?: GlossaryDomain;
	/** Current intent, used to pick relevant few-shot examples. */
	intent?: string;
	/** Include few-shot phrasings (default true for id, ignored otherwise). */
	fewshot?: boolean;
}

export interface CurationResult {
	/** Prompt fragment to append to a system prompt. */
	systemFragment: string;
	/** Terminology locks the reply is expected to honor (for the phrase gate). */
	locks: GlossaryLock[];
	facts: CulturalFact[];
	terms: GlossaryTerm[];
}

// Layer toggle — lets the eval harness measure baseline vs +register vs +KB.
//   off      = no cultural layers (baseline / L0)
//   register = L1 only (tone/honorifics/sensitivity)
//   kb | all = L1 + L2 (facts + glossary + few-shot) — default
type LayerMode = 'off' | 'register' | 'kb' | 'all';
function layerMode(): LayerMode {
	const m = (env.CULTURAL_LAYERS ?? 'all').toLowerCase();
	return m === 'off' || m === 'register' || m === 'kb' ? m : 'all';
}

export function buildCurationContext(input: CurationInput): CurationResult {
	const { query, lang, domain } = input;
	const mode = layerMode();

	const useKb = mode === 'kb' || mode === 'all';
	const facts = useKb ? retrieveCulturalFacts(query) : [];
	const terms = useKb ? selectGlossary(query, lang, domain) : [];

	// Few-shot phrasings (Bahasa): from retrieved facts + the intent-keyed bank,
	// de-duplicated. These are the "living voice" examples for the id path.
	let phrasings: string[] = [];
	if (useKb && input.fewshot !== false && lang === 'id') {
		const fromFacts = fewShotsFromFacts(facts, lang);
		const fromBank = selectFewShots({ intent: input.intent, lang, query }).map((ex) => ex.assistant);
		phrasings = [...new Set([...fromFacts, ...fromBank])].slice(0, 3);
	}

	const parts: string[] = [];
	if (mode !== 'off') parts.push(culturalRegister(lang));
	if (useKb) {
		parts.push(renderCulturalFacts(facts, lang), renderGlossary(terms, lang), renderFewShots(phrasings));
	}

	return {
		systemFragment: parts.filter(Boolean).join('\n\n'),
		locks: buildGlossaryLocks(terms, lang),
		facts,
		terms
	};
}
