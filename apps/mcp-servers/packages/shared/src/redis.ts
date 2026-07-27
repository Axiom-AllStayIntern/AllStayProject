import { createClient } from 'redis';

let client: ReturnType<typeof createClient> | null = null;

export async function getRedis() {
	if (!client) {
		client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' });
		client.on('error', (err) => console.error('Redis error:', err));
		await client.connect();
	}
	return client;
}

export async function getCart(roomId: string): Promise<unknown[]> {
	const redis = await getRedis();
	const raw = await redis.get(`cart:${roomId}`);
	return raw ? JSON.parse(raw) : [];
}

export async function setCart(roomId: string, items: unknown[]): Promise<void> {
	const redis = await getRedis();
	await redis.setEx(`cart:${roomId}`, 3600, JSON.stringify(items)); // 1h TTL
}
