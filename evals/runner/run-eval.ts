// Eval runner — the "demo → engineering" piece. Drives every test case through
// the live pipeline, scores three dimensions, and writes a real before/after
// table. Deterministic dims (task_completion, content_accuracy) need no judge;
// only the cultural dimension uses the LLM judge.
//
// Usage (from repo root, with the tablet + spa MCP server running):
//   # baseline
//   CULTURAL_LAYERS=off PHRASE_MODEL=off  <start tablet server>
//   npx tsx --env-file=.env evals/runner/run-eval.ts --config baseline
//   # optimized
//   CULTURAL_LAYERS=kb  PHRASE_MODEL=off  <restart tablet server>
//   npx tsx --env-file=.env evals/runner/run-eval.ts --config kb
//
// The --config label tags the run; env (CULTURAL_LAYERS/PHRASE_MODEL) is read
// from the runner's environment purely for the report (the SERVER's env is what
// actually changes behavior — keep them in sync).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTurn, type TurnResult } from './harness.js';
import { judgeCriteria, judgeModelName } from './judge.js';
import { summarize, saveRun, renderSummary, type CaseResult } from './report.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TESTSET = path.join(HERE, '..', 'cultural', 'testset.json');
const RESULTS_DIR = path.join(HERE, '..', 'results');
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:5173';
const ROOM = process.env.EVAL_ROOM ?? 'eval-101';
// Delay between cases — set (e.g. 7000) when PHRASE_MODEL=sealion to respect the
// hosted SEA-LION rate limit (~10 req/min per key).
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? '0');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TestCase {
	id: string;
	lang: 'en' | 'zh' | 'id';
	prompt: string;
	dimensions?: {
		task_completion?: { expectIntent?: string; mustNotBook?: boolean; mustBook?: boolean };
		content_accuracy?: { mustMention?: string[]; mustNotContain?: string[] };
		cultural?: { criteria: string[] };
	};
}

function arg(name: string, fallback: string): string {
	const i = process.argv.indexOf(`--${name}`);
	return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function scoreTask(spec: NonNullable<TestCase['dimensions']>['task_completion'], t: TurnResult): number | null {
	if (!spec) return null;
	let pass = 0;
	let total = 0;
	const d = t.data ?? {};
	const booked = !!(d.proposal || d.confirmationCode || d.ok === true);
	if (spec.expectIntent !== undefined) {
		total++;
		if (t.intent === spec.expectIntent) pass++;
	}
	if (spec.mustNotBook) {
		total++;
		if (!booked) pass++;
	}
	if (spec.mustBook) {
		total++;
		if (booked) pass++;
	}
	return total ? pass / total : null;
}

function scoreContent(spec: NonNullable<TestCase['dimensions']>['content_accuracy'], reply: string): number | null {
	if (!spec) return null;
	const r = reply.toLowerCase();
	let pass = 0;
	let total = 0;
	for (const m of spec.mustMention ?? []) {
		total++;
		if (r.includes(m.toLowerCase())) pass++;
	}
	for (const m of spec.mustNotContain ?? []) {
		total++;
		if (!r.includes(m.toLowerCase())) pass++;
	}
	return total ? pass / total : null;
}

async function scoreCultural(prompt: string, reply: string, criteria?: string[]): Promise<number | null> {
	if (!criteria || criteria.length === 0) return null;
	const verdicts = await judgeCriteria(prompt, reply, criteria);
	const passed = verdicts.filter((v) => v.pass).length;
	return passed / criteria.length;
}

async function main() {
	const config = arg('config', process.env.CULTURAL_LAYERS ?? 'default');
	const testset = JSON.parse(fs.readFileSync(TESTSET, 'utf8')) as { cases: TestCase[] };

	console.log(`\nRunning ${testset.cases.length} cases against ${BASE_URL} (config="${config}")\n`);

	const results: CaseResult[] = [];
	let i = 0;
	for (const c of testset.cases) {
		if (i > 0 && DELAY_MS > 0) await sleep(DELAY_MS);
		// Unique room per case so cross-turn guest accumulation never leaks between cases.
		const t = await runTurn(BASE_URL, { message: c.prompt, roomId: `${ROOM}-${i++}`, language: c.lang });
		if (t.error) {
			console.log(`  ✗ ${c.id} [${c.lang}] — error: ${t.error}`);
			results.push({ id: c.id, lang: c.lang, scores: {}, overall: null, error: t.error });
			continue;
		}
		const dims = c.dimensions ?? {};
		const scores: Record<string, number | null> = {
			task_completion: scoreTask(dims.task_completion, t),
			content_accuracy: scoreContent(dims.content_accuracy, t.reply),
			cultural: await scoreCultural(c.prompt, t.reply, dims.cultural?.criteria)
		};
		const present = Object.values(scores).filter((v): v is number => typeof v === 'number');
		const overall = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;
		results.push({ id: c.id, lang: c.lang, intent: t.intent, scores, overall });

		const fmt = (v: number | null) => (typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : '—');
		console.log(
			`  ${overall !== null && overall >= 0.999 ? '✓' : '·'} ${c.id} [${c.lang}] ` +
				`intent=${t.intent ?? '?'} task=${fmt(scores.task_completion)} ` +
				`content=${fmt(scores.content_accuracy)} cultural=${fmt(scores.cultural)}`
		);
	}

	const run = summarize(
		config,
		{ CULTURAL_LAYERS: process.env.CULTURAL_LAYERS ?? '(unset)', PHRASE_MODEL: process.env.PHRASE_MODEL ?? '(unset)' },
		judgeModelName(),
		results
	);
	const file = saveRun(RESULTS_DIR, run);
	fs.writeFileSync(path.join(RESULTS_DIR, 'summary.md'), renderSummary(RESULTS_DIR));

	console.log(`\nSaved ${file}`);
	console.log(`\n${renderSummary(RESULTS_DIR)}\n`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
