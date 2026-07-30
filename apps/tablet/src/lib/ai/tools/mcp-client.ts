export type McpServerName = 'dining' | 'spa' | 'restaurant' | 'transport';

import { env } from '$env/dynamic/private';

function getServerUrls(): Record<McpServerName, string> {
	return {
		dining: env.MCP_DINING_URL ?? 'http://localhost:3001',
		spa: env.MCP_SPA_URL ?? 'http://localhost:3002',
		restaurant: env.MCP_RESTAURANT_URL ?? 'http://localhost:3003',
		transport: env.MCP_TRANSPORT_URL ?? 'http://localhost:3004'
	};
}

export interface McpToolCall {
	server: McpServerName;
	tool: string;
	params: Record<string, unknown>;
}

export interface McpToolResult {
	success: boolean;
	data?: unknown;
	error?: string;
}

export async function callMcpTool(call: McpToolCall): Promise<McpToolResult> {
	const url = `${getServerUrls()[call.server]}/api/mcp`;
	const body = {
		jsonrpc: '2.0',
		id: crypto.randomUUID(),
		method: 'tools/call',
		params: {
			name: call.tool,
			arguments: call.params
		}
	};

	let res: Response;
	try {
		res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				// StreamableHTTPServerTransport requires BOTH content types in Accept,
				// otherwise it rejects the request with HTTP 406.
				Accept: 'application/json, text/event-stream',
				...(call.server === 'spa' && env.MCP_SPA_API_TOKEN
					? { Authorization: `Bearer ${env.MCP_SPA_API_TOKEN}` }
					: {})
			},
			body: JSON.stringify(body)
		});
	} catch {
		return { success: false, error: `MCP server unreachable: ${call.server}` };
	}

	if (!res.ok) {
		return { success: false, error: `HTTP ${res.status}` };
	}

	// StreamableHTTPServerTransport may answer as JSON or as an SSE stream
	// (`event: message\ndata: <json-rpc>`); handle both.
	let json: { result?: unknown; error?: { message?: string } };
	try {
		const contentType = res.headers.get('content-type') ?? '';
		json = contentType.includes('text/event-stream')
			? parseSseJsonRpc(await res.text())
			: await res.json();
	} catch (e) {
		return { success: false, error: `bad MCP response: ${(e as Error).message}` };
	}

	if (json.error) {
		return { success: false, error: json.error.message };
	}

	// MCP `tools/call` wraps the payload as { content: [{ type: 'text', text: '<json>' }] }.
	// Unwrap it so callers get the actual payload object as `data`, not the envelope.
	return { success: true, data: unwrapMcpResult(json.result) };
}

// Pull the JSON-RPC envelope out of an SSE body. The transport emits one or
// more `data: <json>` lines; the last data payload holds the tools/call result.
function parseSseJsonRpc(body: string): { result?: unknown; error?: { message?: string } } {
	let last: { result?: unknown; error?: { message?: string } } = {};
	for (const line of body.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed.startsWith('data:')) continue;
		const payload = trimmed.slice(5).trim();
		if (!payload || payload === '[DONE]') continue;
		try {
			last = JSON.parse(payload);
		} catch {
			// ignore keep-alive / non-JSON data lines
		}
	}
	return last;
}

function unwrapMcpResult(result: unknown): unknown {
	const content = (result as { content?: unknown })?.content;
	if (Array.isArray(content)) {
		const textNode = content.find(
			(c): c is { type: string; text: string } =>
				!!c && (c as { type?: string }).type === 'text' && typeof (c as { text?: unknown }).text === 'string'
		);
		if (textNode) {
			try {
				return JSON.parse(textNode.text);
			} catch {
				return textNode.text;
			}
		}
	}
	return result;
}
