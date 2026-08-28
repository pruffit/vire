import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> };

// Пул задаётся явно: дефолт postgres.js — 10 соединений НА ПРОЦЕСС, а процессов
// два (web и worker) при `max_connections=30` у Postgres. Каждый бэкенд стоит
// памяти на машине, где её 2 ГБ на шесть контейнеров.
const poolMax = Number(process.env.PG_POOL_MAX ?? 5);

const client =
  globalForDb._pgClient ??
  postgres(connectionString, {
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;

export async function ping(): Promise<void> {
  await client`SELECT 1`;
}
