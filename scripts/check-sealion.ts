// SEA-LION connectivity self-check — verify your API key + endpoint before
// turning on PHRASE_MODEL=sealion in the app.
//
// Usage (from repo root):
//   npx tsx --env-file=.env scripts/check-sealion.ts
//   # or without a .env file:
//   SEALION_API_KEY=sk-... npx tsx scripts/check-sealion.ts
//
// Get a key at https://playground.sea-lion.ai (Google sign-in → API Key Manager).
// This mirrors apps/tablet/src/lib/ai/providers/sealion-provider.ts but reads
// process.env directly so it can run as a plain Node script (no SvelteKit).

import OpenAI from 'openai';

const BASE_URL = process.env.SEALION_BASE_URL ?? 'https://api.sea-lion.ai/v1';
const MODEL = process.env.SEALION_MODEL ?? 'aisingapore/Gemma-SEA-LION-v4-27B-IT';
const KEY = process.env.SEALION_API_KEY ?? '';

async function main() {
	console.log('SEA-LION connectivity check');
	console.log(`  base URL : ${BASE_URL}`);
	console.log(`  model    : ${MODEL}`);
	console.log(`  api key  : ${KEY && KEY !== 'your_sealion_api_key_here' ? '(set)' : '(MISSING)'}\n`);

	if (!KEY || KEY === 'your_sealion_api_key_here') {
		console.error('✗ SEALION_API_KEY is not set. Create one at https://playground.sea-lion.ai and put it in .env.');
		process.exit(2);
	}

	const client = new OpenAI({ apiKey: KEY, baseURL: BASE_URL });

	// 1. List models available to this key.
	try {
		const models = await client.models.list();
		const ids = models.data.map((m) => m.id);
		console.log(`✓ /v1/models reachable — ${ids.length} model(s) available:`);
		for (const id of ids) console.log(`    - ${id}`);
		if (!ids.includes(MODEL)) {
			console.warn(`\n⚠ Configured SEALION_MODEL "${MODEL}" not in the list above — pick one that is.`);
		}
		console.log('');
	} catch (e) {
		console.error(`✗ Could not list models: ${(e as Error).message}`);
		process.exit(1);
	}

	// 2. Sample phrase call (English draft → warm Bahasa), like the gateway does.
	try {
		const res = await client.chat.completions.create({
			model: MODEL,
			max_tokens: 256,
			temperature: 0.5,
			messages: [
				{
					role: 'system',
					content:
						'You are a native Bahasa Indonesia editor for a Bali resort concierge. Rephrase the DRAFT into warm, polite Bahasa Indonesia (use Bapak/Ibu). Keep all numbers and proper nouns. Reply with ONLY the rephrased text.'
				},
				{
					role: 'user',
					content:
						'DRAFT: I found the Aromatherapy Massage on 2026-08-01 at 14:00 for IDR 550,000. Shall I confirm the booking?'
				}
			]
		});
		const text = res.choices?.[0]?.message?.content?.trim() ?? '(empty)';
		console.log('✓ Sample phrase call succeeded:\n');
		console.log(`    ${text}\n`);
		console.log('All good — you can set PHRASE_MODEL=sealion in .env.');
	} catch (e) {
		console.error(`✗ Chat completion failed: ${(e as Error).message}`);
		process.exit(1);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
