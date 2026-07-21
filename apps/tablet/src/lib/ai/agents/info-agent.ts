export interface InfoIntent {
	query: string;
	language: 'en' | 'zh' | 'id';
}

export interface AgentResult {
	success: boolean;
	reply: string;
	data?: unknown;
}

// Static knowledge base — Phase 4 will connect to a proper Info MCP Server
const FAQ: Record<string, string> = {
	wifi: 'The WiFi network is "AllStay_Guest". No password required. Enjoy complimentary high-speed internet throughout the property.',
	pool: 'The pool is open daily from 7:00 AM to 10:00 PM. Towels are available poolside.',
	checkout: 'Standard checkout time is 12:00 PM. Late checkout until 2:00 PM is available upon request.',
	breakfast: 'Breakfast is served at The Garden Restaurant from 7:00 AM to 10:30 AM.',
	currency: 'The local currency is Indonesian Rupiah (IDR). ATMs are available at the lobby.'
};

export async function handleInfoIntent(intent: InfoIntent): Promise<AgentResult> {
	const queryLower = intent.query.toLowerCase();
	for (const [keyword, answer] of Object.entries(FAQ)) {
		if (queryLower.includes(keyword)) {
			return { success: true, reply: answer };
		}
	}

	return {
		success: true,
		reply: 'I\'m not sure about that. Please contact the front desk by dialing "0" on your room phone, and our team will be happy to help.'
	};
}
