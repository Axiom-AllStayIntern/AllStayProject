// Mock provider — a GPU-free, offline stand-in for SEA-LION so the two-stage
// localization path (route → phrase → verify → fallback) is fully demoable with
// no network or model. It does not "understand" — it deterministically wraps the
// draft in a warm Bahasa frame, preserving numbers/terms so the verification
// gate passes. Set PHRASE_MOCK_DRIFT=1 to make it deliberately corrupt the
// output (drop numbers, mistranslate proper nouns) and prove the gate + fallback.

import { env } from '$env/dynamic/private';
import type { LlmProvider } from './provider.js';

export const mockProvider: LlmProvider = {
	id: 'mock',
	capabilities: new Set(['native_id']),
	async generate(req) {
		const joined = req.messages.map((m) => m.content).join('\n');
		const m = joined.match(/DRAFT:\s*([\s\S]*)$/);
		const body = (m?.[1] ?? joined).trim();

		// Stand-in "localization": a warm Indonesian frame around the draft body,
		// keeping the body verbatim so facts/numbers/terms survive the gate.
		let out = `Baik, Bapak/Ibu. ${body}`;

		if (env.PHRASE_MOCK_DRIFT === '1') {
			// Simulate a weak model dropping a number and mistranslating a proper noun.
			out = out.replace(/\d[\d.,:]*/g, '').replace(/Nyepi/gi, 'hari sepi');
		}

		return { text: out, stopReason: 'end' };
	}
};
