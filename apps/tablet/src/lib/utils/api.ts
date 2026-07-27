const BASE_URL = '';

interface FetchOptions extends RequestInit {
	params?: Record<string, string>;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
	const { params, ...init } = options;
	const url = new URL(BASE_URL + path, window.location.origin);
	if (params) {
		Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
	}

	const res = await fetch(url.toString(), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init.headers
		}
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({ message: res.statusText }));
		throw new Error(error.message ?? `HTTP ${res.status}`);
	}

	return res.json() as Promise<T>;
}

export const api = {
	get: <T>(path: string, params?: Record<string, string>) =>
		request<T>(path, { method: 'GET', params }),
	post: <T>(path: string, body: unknown) =>
		request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
	put: <T>(path: string, body: unknown) =>
		request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
	delete: <T>(path: string) => request<T>(path, { method: 'DELETE' })
};
