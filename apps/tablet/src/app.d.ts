declare global {
	namespace App {
		interface Platform {
			env: {
				SPA_MCP?: {
					fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
				};
				[key: string]: unknown;
			};
		}

		interface Locals {
			staffId?: string;
			token?: string;
		}
	}
}

export {};
