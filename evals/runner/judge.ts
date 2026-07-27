// LLM-as-judge — grades each cultural criterion pass/fail on the reply text.
// Uses forced tool_choice (same discipline as the orchestrator) so the verdict
// is always schema-shaped. Judge model + date are recorded in the report so a
// number like "72% → 91% (n=15, judge=claude-sonnet-4-6)" is defensible.

import Anthropic from '@anthropic-ai/sdk';

const JUDGE_MODEL = process.env.JUDGE_MODEL ?? process.env.AI_MODEL ?? 'claude-sonnet-4-6';

let _client: Anthropic | null = null;
function client(): Anthropic {
	if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
	return _client;
}

export function judgeModelName(): string {
	return JUDGE_MODEL;
}

export interface CriterionVerdict {
	criterion: string;
	pass: boolean;
	reason: string;
}

const GRADE_TOOL = {
	name: 'grade',
	description: 'Return a pass/fail verdict for each criterion, in order.',
	input_schema: {
		type: 'object' as const,
		properties: {
			verdicts: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						criterion: { type: 'string' },
						pass: { type: 'boolean' },
						reason: { type: 'string' }
					},
					required: ['criterion', 'pass', 'reason']
				}
			}
		},
		required: ['verdicts']
	}
};

export async function judgeCriteria(
	prompt: string,
	reply: string,
	criteria: string[]
): Promise<CriterionVerdict[]> {
	if (criteria.length === 0) return [];
	if (!reply.trim()) return criteria.map((c) => ({ criterion: c, pass: false, reason: 'empty reply' }));

	const res = await client().messages.create({
		model: JUDGE_MODEL,
		max_tokens: 1024,
		tools: [GRADE_TOOL],
		tool_choice: { type: 'tool', name: 'grade' },
		messages: [
			{
				role: 'user',
				content:
					`A hotel concierge for a Bali resort was asked, and replied. Grade STRICTLY.\n\n` +
					`GUEST: ${prompt}\n\nCONCIERGE REPLY: ${reply}\n\n` +
					`Criteria (grade each, in order):\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
			}
		]
	});

	const block = res.content.find((b) => b.type === 'tool_use') as
		| { input?: { verdicts?: Array<{ pass?: boolean; reason?: string }> } }
		| undefined;
	const verdicts = block?.input?.verdicts ?? [];

	return criteria.map((c, i) => {
		const v = verdicts[i];
		return v
			? { criterion: c, pass: !!v.pass, reason: String(v.reason ?? '') }
			: { criterion: c, pass: false, reason: 'no verdict returned' };
	});
}
