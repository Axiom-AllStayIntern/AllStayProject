// Harness — drives the REAL pipeline over HTTP (the SSE /api/conversation
// endpoint), so the eval exercises the same orchestrator → gateway → curation →
// constraints → MCP path a guest hits. No importing SvelteKit internals (which
// need vite's $env alias); just fetch + parse the SSE stream to the final event.

export interface TurnResult {
	reply: string;
	intent?: string;
	data?: Record<string, unknown>;
	error?: string;
}

export interface TurnInput {
	message: string;
	roomId: string;
	language: 'en' | 'zh' | 'id';
	history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function runTurn(baseUrl: string, input: TurnInput): Promise<TurnResult> {
	let res: Response;
	try {
		res = await fetch(`${baseUrl}/api/conversation`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(input)
		});
	} catch (e) {
		return { reply: '', error: `fetch failed: ${(e as Error).message}` };
	}
	if (!res.ok || !res.body) return { reply: '', error: `HTTP ${res.status}` };

	const reader = res.body.getReader();
	const dec = new TextDecoder();
	let buf = '';
	let done: { reply?: string; intent?: string; data?: Record<string, unknown> } | null = null;
	let err: string | undefined;

	for (;;) {
		const { value, done: streamDone } = await reader.read();
		if (streamDone) break;
		buf += dec.decode(value, { stream: true });
		let idx: number;
		while ((idx = buf.indexOf('\n\n')) >= 0) {
			const frame = buf.slice(0, idx);
			buf = buf.slice(idx + 2);
			const m = frame.match(/^data: ([\s\S]*)$/);
			if (!m) continue;
			try {
				const evt = JSON.parse(m[1]);
				if (evt.t === 'done') done = evt;
				else if (evt.t === 'error') err = evt.message;
			} catch {
				/* partial/invalid frame */
			}
		}
	}

	if (err) return { reply: '', error: err };
	if (done) return { reply: done.reply ?? '', intent: done.intent, data: done.data };
	return { reply: '', error: 'no done event received' };
}
