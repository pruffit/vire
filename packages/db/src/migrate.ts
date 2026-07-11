// Прод-миграции: программный мигратор drizzle-orm (без drizzle-kit), запуск из
// ops-образа: docker compose run --rm worker pnpm --filter @vire/db exec tsx src/migrate.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL не задан');
  process.exit(1);
}

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder });
  console.log('Миграции применены:', migrationsFolder);
} catch (err) {
  console.error('Миграции упали:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
