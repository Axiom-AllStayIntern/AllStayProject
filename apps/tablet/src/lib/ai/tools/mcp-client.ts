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
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch {
		return { success: false, error: `MCP server unreachable: ${call.server}` };
	}

	if (!res.ok) {
		return { success: false, error: `HTTP ${res.status}` };
	}

	const json = await res.json();
	if (json.error) {
		return { success: false, error: json.error.message };
	}

	return { success: true, data: json.result };
}
