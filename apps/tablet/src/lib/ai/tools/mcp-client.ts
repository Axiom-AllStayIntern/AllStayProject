export type McpServerName = 'dining' | 'spa' | 'restaurant' | 'transport';

const SERVER_URLS: Record<McpServerName, string> = {
	dining: process.env.MCP_DINING_URL ?? 'http://localhost:3001',
	spa: process.env.MCP_SPA_URL ?? 'http://localhost:3002',
	restaurant: process.env.MCP_RESTAURANT_URL ?? 'http://localhost:3003',
	transport: process.env.MCP_TRANSPORT_URL ?? 'http://localhost:3004'
};

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
	const url = `${SERVER_URLS[call.server]}/api/mcp`;
	const body = {
		jsonrpc: '2.0',
		id: crypto.randomUUID(),
		method: 'tools/call',
		params: {
			name: call.tool,
			arguments: call.params
		}
	};

	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		return { success: false, error: `HTTP ${res.status}` };
	}

	const json = await res.json();
	if (json.error) {
		return { success: false, error: json.error.message };
	}

	return { success: true, data: json.result };
}
