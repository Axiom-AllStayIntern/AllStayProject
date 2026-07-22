// Provider abstraction — separates "how we call a model" from "which model".
//
// The gateway (llm-gateway.ts) routes a task to a provider; callers never new
// up an SDK directly. P0 uses the generate() path for the localization/phrase
// step (the routing feature that matters for the demo). Tool-calling classify
// still runs on the Anthropic client via anthropic-provider's getAnthropic()
// (SDK-specific streaming of forced tool input), and is the documented next
// extension point for a neutral ToolSpec.

export type Capability = 'tool_use' | 'streaming' | 'native_id';

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface GenerateRequest {
	system?: string;
	messages: ChatMessage[];
	maxTokens?: number;
	temperature?: number;
}

export interface GenerateResult {
	text: string;
	stopReason: 'end' | 'length' | 'error';
	raw?: unknown;
}

export interface LlmProvider {
	id: 'anthropic' | 'sealion' | 'mock';
	capabilities: Set<Capability>;
	generate(req: GenerateRequest): Promise<GenerateResult>;
}
