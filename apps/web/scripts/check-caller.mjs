#!/usr/bin/env node
/**
 * Барьер волны 4 (`docs/migration-plan.md` §4.1): роуты `app/api/**` получают актора
 * только через `getCaller()` (`lib/caller.ts`) — это единственная точка, куда добавляется
 * Bearer. Прямой импорт `@/auth` в роуте означает, что запрос с токеном устройства
 * пройдёт мимо и роут останется cookie-only.
 *
 * Исключения: сам обработчик Auth.js и тестовые файлы (они мокают '@/auth').
 *
 * Запуск: node scripts/check-caller.mjs   (cwd = apps/web)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'api');
const AUTH_IMPORT_RE = /from\s+['"]@\/auth['"]/;
const EXEMPT = ['auth/[...nextauth]/route.ts'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const offenders = [];
let checked = 0;

for (const file of walk(API_DIR)) {
  const rel = relative(API_DIR, file).replace(/\\/g, '/');
  if (EXEMPT.includes(rel)) continue;
  checked += 1;
  if (AUTH_IMPORT_RE.test(readFileSync(file, 'utf8'))) offenders.push(rel);
}

if (offenders.length > 0) {
  console.error('✗ check:caller — роуты обращаются к auth() напрямую вместо getCaller():');
  for (const f of offenders) console.error(`  app/api/${f}`);
  console.error('\n  Актор берётся через getCaller() из @/lib/caller — иначе Bearer-запрос пройдёт мимо роута.');
  process.exit(1);
}

console.log(`✓ check:caller — ${checked} роутов берут актора через getCaller()`);
