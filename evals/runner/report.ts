// Report — aggregates case results into a run summary and renders the before/
// after markdown table across every saved run in evals/results/.

import fs from 'node:fs';
import path from 'node:path';

export interface CaseResult {
	id: string;
	lang: string;
	intent?: string;
	scores: Record<string, number | null>; // dimension -> [0,1] or null (not applicable)
	overall: number | null;
	error?: string;
}

export interface RunSummary {
	config: string;
	date: string;
	env: Record<string, string>;
	judgeModel: string;
	n: number;
	byDimension: Record<string, number | null>;
	overall: number | null;
	cases: CaseResult[];
}

const DIMENSIONS = ['task_completion', 'content_accuracy', 'cultural'];

export function summarize(
	config: string,
	env: Record<string, string>,
	judgeModel: string,
	cases: CaseResult[]
): RunSummary {
	const byDimension: Record<string, number | null> = {};
	for (const dim of DIMENSIONS) {
		const vals = cases.map((c) => c.scores[dim]).filter((v): v is number => typeof v === 'number');
		byDimension[dim] = vals.length ? mean(vals) : null;
	}
	const overalls = cases.map((c) => c.overall).filter((v): v is number => typeof v === 'number');
	return {
		config,
		date: new Date().toISOString().slice(0, 10),
		env,
		judgeModel,
		n: cases.length,
		byDimension,
		overall: overalls.length ? mean(overalls) : null,
		cases
	};
}

export function saveRun(resultsDir: string, run: RunSummary): string {
	fs.mkdirSync(resultsDir, { recursive: true });
	const file = path.join(resultsDir, `${run.config}-${run.date}.json`);
	fs.writeFileSync(file, JSON.stringify(run, null, 2));
	return file;
}

/** Render every saved run into one comparison table (newest per config wins). */
export function renderSummary(resultsDir: string): string {
	if (!fs.existsSync(resultsDir)) return '(no runs yet)';
	const runs = fs
		.readdirSync(resultsDir)
		.filter((f) => f.endsWith('.json'))
		.map((f) => JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8')) as RunSummary);

	if (runs.length === 0) return '(no runs yet)';

	const header =
		`| Config | Task completion | Content accuracy | Cultural | Overall | N | Judge | Date |\n` +
		`| --- | --- | --- | --- | --- | --- | --- | --- |`;
	const rows = runs
		.sort((a, b) => a.config.localeCompare(b.config))
		.map(
			(r) =>
				`| ${r.config} | ${pct(r.byDimension.task_completion)} | ${pct(r.byDimension.content_accuracy)} | ` +
				`${pct(r.byDimension.cultural)} | ${pct(r.overall)} | ${r.n} | ${r.judgeModel} | ${r.date} |`
		);

	return [
		'# AllStay eval results (generated — do not hand-edit)',
		'',
		header,
		...rows,
		'',
		'_Numbers come from real runs via evals/runner. Configs set by CULTURAL_LAYERS / PHRASE_MODEL._'
	].join('\n');
}

function mean(xs: number[]): number {
	return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(v: number | null | undefined): string {
	return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—';
}
