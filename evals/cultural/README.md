# Cultural-response evaluation (Bali / Indonesia)

Purpose: measure — honestly and reproducibly — how culturally appropriate the concierge's replies are, so the "cultural response accuracy improved from X% to Y%" claim is backed by a real number instead of a guess.

## The three-layer optimization being measured

1. **Prompt register control** — `apps/tablet/src/lib/ai/cultural/cultural-register.ts` (honorifics, indirect/face-saving phrasing, halal & Nyepi sensitivity).
2. **Saka cultural knowledge base** — `apps/tablet/src/lib/ai/cultural/cultural-kb.ts` (retrieved facts injected into the prompt).
3. **Regional model selection** — swap the generation model (e.g. Claude vs SEA-LION / Sahabat-AI) behind the model gateway and re-measure.

## Metric — three dimensions

`testset.json` (v0.3, n=33 — 14 en / 9 zh / 10 id) scores each case across up to three dimensions:

- **task_completion** — deterministic: did the system reach the right intent / (not) book? (e.g. a pregnant guest's hot-stone booking must be refused). No judge.
- **content_accuracy** — deterministic substring checks (`mustMention` / `mustNotContain`, e.g. reply mentions "halal", never assumes "pork").
- **cultural** — `satisfied_criteria / total_criteria` graded by an **LLM-as-judge**, then **human spot-check** ~20% of judgements. Report inter-rater agreement.

Per-case `overall` = mean of the applicable dimensions; a run's score = mean across cases per dimension.

## How to run (produces the real before/after numbers)

A runnable harness lives in [`evals/runner`](../runner) (`run-eval.ts` + `harness.ts` + `judge.ts` + `report.ts`). It drives the **live** pipeline over HTTP (`/api/conversation`), so it exercises the real orchestrator → gateway → curation → constraints → MCP path.

Prereqs: the tablet server + spa MCP server running, `ANTHROPIC_API_KEY` set.

```sh
# Baseline (L0): start the tablet with CULTURAL_LAYERS=off PHRASE_MODEL=off, then:
npx tsx --env-file=.env evals/runner/run-eval.ts --config baseline
# + Register (L1): restart with CULTURAL_LAYERS=register, then:
npx tsx --env-file=.env evals/runner/run-eval.ts --config register
# + Register + KB (L2): restart with CULTURAL_LAYERS=kb, then:
npx tsx --env-file=.env evals/runner/run-eval.ts --config kb
# + Regional model (L3): CULTURAL_LAYERS=kb PHRASE_MODEL=sealion, then --config sealion
#   (SEA-LION hosted API is ~10 req/min — add EVAL_DELAY_MS=7000 to space out cases)
```

Each run writes `evals/results/<config>-<date>.json` and regenerates `evals/results/summary.md` (the real before/after table).

> Do **not** fill in the percentages by hand. They must come from an actual run. A claim like "72% → 91% (n=15, judge=claude-sonnet-4-6, human-checked)" is defensible; a bare "XX% → YY%" is not.

## Results (from real runs)

Source of truth is the auto-generated [`../results/summary.md`](../results/summary.md); the
per-case detail is in `../results/<config>-<date>.json`. Latest run (2026-07-26,
judge=claude-sonnet-4-6, n=33):

| Configuration | Task completion | Content accuracy | Cultural | Overall | N |
| --- | --- | --- | --- | --- | --- |
| Baseline (layers off, phrasing off) | 80.0% | 60.0% | 37.1% | 42.4% | 33 |
| + all cultural layers + SEA-LION phrasing (Gemma-SEA-LION-v4-27B-IT) | 80.0% | 60.0% | 40.3% | 43.9% | 33 |

Reading it honestly: task-completion and content-accuracy are deterministic and unchanged
(the cultural layers/phrasing don't alter intent routing or the substring facts). The gain is
in **cultural appropriateness (+3.2pp, 37.1%→40.3%)** and overall (+1.5pp). The effect is
bounded because SEA-LION phrasing only fires on the 10 `id` cases (and the verify gate falls
back to Claude when a rephrase drops a number/locked term), while the 23 en/zh cases benefit
only from the register+KB layers. The intermediate `register` / `kb` rungs were not run this
pass — re-run with `CULTURAL_LAYERS=register` then `=kb` to attribute each layer's share.

## Notes / caveats

- `testset.json` is v0.3 (n=33, balanced en/zh/id). Grow it to ≥50 for a more stable number; add cases from real guest logs once available.
- Balance languages (en/zh/id) and topics (faith, calendar, etiquette, honorifics) so the score isn't dominated by one theme.
- Indonesian (`id`) cases are included (the pipeline now supports Bahasa end-to-end; STT maps `indonesian`/`malay`→`id`).
