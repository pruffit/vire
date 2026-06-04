import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

// Singleton to avoid exhausting the connection pool during Next.js hot reload
const globalForDb = globalThis as unknown as { _pgClient?: ReturnType<typeof postgres> };

const client = globalForDb._pgClient ?? postgres(connectionString);
if (process.env.NODE_ENV !== 'production') globalForDb._pgClient = client;

export const db = drizzle(client, { schema });

export async function ping(): Promise<void> {
  await client`SELECT 1`;
}

export * from './schema';
export type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
