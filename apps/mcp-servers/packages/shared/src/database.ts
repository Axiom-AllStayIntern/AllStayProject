import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getDb(): mysql.Pool {
	if (!pool) {
		pool = mysql.createPool({
			host: process.env.DB_HOST ?? 'localhost',
			port: Number(process.env.DB_PORT ?? 3306),
			database: process.env.DB_NAME ?? 'cakrasoft_pms',
			user: process.env.DB_USER ?? 'allstay',
			password: process.env.DB_PASSWORD ?? '',
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0
		});
	}
	return pool;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
	const db = getDb();
	const [rows] = await db.execute(sql, params);
	return rows as T[];
}
