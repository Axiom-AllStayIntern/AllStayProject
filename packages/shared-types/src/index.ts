// Cross-package shared types — importable by both tablet and mcp-servers

export interface LocalizedString {
	en: string;
	zh: string;
}

export type Language = 'en' | 'zh';

export interface JsonRpcRequest {
	jsonrpc: '2.0';
	id: string;
	method: string;
	params: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
	jsonrpc: '2.0';
	id: string;
	result?: T;
	error?: { code: number; message: string };
}
