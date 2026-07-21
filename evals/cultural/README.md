# Cultural-response evaluation (Bali / Indonesia)

Purpose: measure — honestly and reproducibly — how culturally appropriate the concierge's replies are, so the "cultural response accuracy improved from X% to Y%" claim is backed by a real number instead of a guess.

## The three-layer optimization being measured

1. **Prompt register control** — `apps/tablet/src/lib/ai/cultural/cultural-register.ts` (honorifics, indirect/face-saving phrasing, halal & Nyepi sensitivity).
2. **Saka cultural knowledge base** — `apps/tablet/src/lib/ai/cultural/cultural-kb.ts` (retrieved facts injected into the prompt).
3. **Regional model selection** — swap the generation model (e.g. Claude vs SEA-LION / Sahabat-AI) behind the model gateway and re-measure.

## Metric

`cultural_response_accuracy = satisfied_criteria / total_criteria`, averaged over all cases in `testset.json`. Each case lists concrete pass/fail criteria.

Scoring: use an **LLM-as-judge** (a strong model grades each criterion pass/fail given the prompt + reply), then **human spot-check** ~20% of judgements to validate the judge. Report inter-rater agreement.

## How to run (to produce the real before/after numbers)

1. **Baseline** — generate a reply for every case with the cultural layers OFF (plain system prompt, base model). Score. This is your `X%`.
2. **Optimized** — turn on Layer 1 + Layer 2 (and, for Layer 3, the chosen regional model). Score. This is your `Y%`.
3. Keep the test set, model versions, judge model, and date fixed per run; report N (number of cases) alongside the percentages.

> Do **not** fill in the percentages by hand. They must come from an actual run. A claim like "72% → 91% (n=10, judge=Claude, human-checked)" is defensible; a bare "XX% → YY%" is not.

## Results (fill in from real runs)

| Configuration | Model | Accuracy | N | Date |
| --- | --- | --- | --- | --- |
| Baseline (no cultural layers) | — | — | 10 | — |
| + Register (L1) | — | — | 10 | — |
| + Register + Saka KB (L2) | — | — | 10 | — |
| + Regional model (L3) | — | — | 10 | — |

## Notes / caveats

- `testset.json` is a small starter set (n=10). Grow it to ≥50 for a stable number; add cases from real guest logs once available.
- Balance languages (en/zh/id) and topics (faith, calendar, etiquette, honorifics) so the score isn't dominated by one theme.
- Indonesian (`id`) cases should be added once the STT/pipeline supports Bahasa Indonesia end-to-end.
