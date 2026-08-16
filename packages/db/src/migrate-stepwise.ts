/**
 * Пошаговый накат миграций: КАЖДАЯ миграция в своей транзакции.
 *
 * Штатный `db:migrate:prod` (drizzle-orm migrator) оборачивает весь набор в одну
 * транзакцию, а Postgres запрещает использовать значение enum в той же транзакции,
 * где оно добавлено (`unsafe use of new value ... of enum type`). На проде это не
 * всплывает — миграции приезжают порциями по релизам, — но накат с нуля (новый
 * инстанс, стейджинг, восстановление из бэкапа, свежая локальная база) падает
 * на 0017 (`ADD VALUE 'PERSONAL'`) + 0051 (использование этого значения).
 *
 * Формат журнала совпадает с drizzle (drizzle.__drizzle_migrations: hash = sha256
 * файла, created_at = when из meta/_journal.json), поэтому после этого скрипта
 * обычный мигратор видит базу как полностью мигрированную.
 *
 * Запуск: pnpm --filter @vire/db db:migrate:fresh
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL не задан');
  process.exit(1);
}

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const journal = JSON.parse(
  readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
) as { entries: JournalEntry[] };

const sql = postgres(url, { max: 1 });

try {
  await sql.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const [last] = await sql.unsafe<{ created_at: string | null }[]>(
    'select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1',
  );
  const lastApplied = last?.created_at ? Number(last.created_at) : null;

  let applied = 0;
  for (const entry of journal.entries) {
    if (lastApplied !== null && lastApplied >= entry.when) continue;

    const file = readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), 'utf8');
    const hash = crypto.createHash('sha256').update(file).digest('hex');
    const statements = file.split('--> statement-breakpoint');

    await sql.begin(async (tx) => {
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed) await tx.unsafe(trimmed);
      }
      await tx.unsafe(
        'insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values($1, $2)',
        [hash, entry.when],
      );
    });

    applied += 1;
    console.log(`  ✓ ${entry.tag}`);
  }

  console.log(applied > 0 ? `Применено миграций: ${applied}` : 'Нечего применять — база актуальна');
} catch (err) {
  console.error('Миграции упали:', err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
