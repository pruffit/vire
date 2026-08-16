#!/usr/bin/env node
/**
 * Барьер волны 3 (`docs/migration-plan.md` §3.2): каждый `app/api/v1/.../route.ts`
 * обязан импортировать хотя бы один символ из `@vire/api-contracts`, кроме путей
 * в ALLOWLIST ниже (непереведённые группы, с причиной у каждой строки).
 *
 * Анти-протухание allowlist: красный, если (а) allowlist-запись уже покрыта роутом,
 * который импортирует контракты (запись пора убрать), (б) allowlist-запись не
 * матчит ни одного реального файла (путь не существует).
 *
 * Запуск: node scripts/check-contracts.mjs   (cwd = apps/web)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'api', 'v1');
const CONTRACT_IMPORT_RE = /from\s+['"]@vire\/api-contracts['"]/;

// Каждая запись — pattern (`*` = сегмент, `**` = любой хвост пути) + причина.
const ALLOWLIST = [
  { pattern: 'admin/**', reason: 'backoffice, единственный потребитель — веб (api-contracts.md §7)' },
  { pattern: 'dashboard/**', reason: 'мультипарт + ручная валидация входа, отдельный подпроект' },
  { pattern: 'jam/**', reason: 'union-типы + SSE, отдельный подпроект' },
  { pattern: 'keys/**', reason: 'E2EE-протокол, не JSON REST контракт' },
  { pattern: 'webhooks/**', reason: 'форму задаёт провайдер (YooKassa), не мы' },
  { pattern: 'health/route.ts', reason: 'служебный пинг, не ресурс' },
  { pattern: '**/stream/route.ts', reason: 'SSE-поток, не запрос-ответ' },
  { pattern: 'search/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'tracks/[id]/download/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'tracks/[id]/listening/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'tracks/[id]/lyrics/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'tracks/[id]/manifest/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'tracks/[id]/moments/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'tracks/[id]/moods/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'tracks/[id]/purchase/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'user/**', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'users/**', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'feedback/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'reports/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'session/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'presence/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'push/**', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'presave/**', reason: 'точечный остаток волны 3 (releases/[id]/presave уже на контрактах)' },
  { pattern: 'party/**', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'listening-now/route.ts', reason: 'точечный остаток волны 3, не переведён' },
  { pattern: 'realtime/**', reason: 'SSE + точечный остаток волны 3, не переведён' },
];

/** Конвертирует pattern (`*`, `**`) в RegExp. `[`/`]` в наших роутах литеральные — не char class. */
function patternToRegExp(pattern) {
  const body = pattern
    .split('**')
    .map((part) =>
      part
        .split('*')
        .map((seg) => seg.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${body}$`);
}

function collectRouteFiles(dir, relPath) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...collectRouteFiles(full, rel));
    } else if (entry.name === 'route.ts') {
      out.push({ rel, full });
    }
  }
  return out;
}

if (!existsSync(API_DIR)) {
  console.error(`check-contracts: app/api/v1 не найден по ${API_DIR}`);
  process.exit(2);
}

const routes = collectRouteFiles(API_DIR, '');
const rules = ALLOWLIST.map((entry) => ({ ...entry, regexp: patternToRegExp(entry.pattern), matches: 0 }));

const uncontracted = [];
const stale = [];
let onContractsCount = 0;
let allowlistedCount = 0;

for (const route of routes) {
  const src = readFileSync(route.full, 'utf8');
  const hasContract = CONTRACT_IMPORT_RE.test(src);
  const matchedRules = rules.filter((rule) => rule.regexp.test(route.rel));
  for (const rule of matchedRules) rule.matches += 1;

  if (hasContract) onContractsCount += 1;

  if (matchedRules.length > 0) {
    allowlistedCount += 1;
    if (hasContract) {
      stale.push({ route: route.rel, patterns: matchedRules.map((r) => r.pattern) });
    }
  } else if (!hasContract) {
    uncontracted.push(route.rel);
  }
}

const emptyRules = rules.filter((r) => r.matches === 0);

let hasError = false;

if (uncontracted.length > 0) {
  hasError = true;
  console.error(`\n✗ Роуты без контракта и вне allowlist (${uncontracted.length}):\n`);
  for (const rel of uncontracted) console.error(`  app/api/v1/${rel}`);
  console.error(
    '\n  Импортируй схему ответа из @vire/api-contracts и верни объект `satisfies XxxResponse`,' +
      '\n  либо добавь путь в ALLOWLIST в scripts/check-contracts.mjs с причиной.\n',
  );
}

if (stale.length > 0) {
  hasError = true;
  console.error(`\n✗ Allowlist протух — роут уже на контрактах, но всё ещё в allowlist (${stale.length}):\n`);
  for (const item of stale) {
    console.error(`  app/api/v1/${item.route}  ←  ${item.patterns.join(', ')}`);
  }
  console.error('\n  Убери соответствующую запись из ALLOWLIST в scripts/check-contracts.mjs.\n');
}

if (emptyRules.length > 0) {
  hasError = true;
  console.error(`\n✗ Allowlist ссылается на несуществующие пути (${emptyRules.length}):\n`);
  for (const rule of emptyRules) console.error(`  ${rule.pattern}`);
  console.error('\n  Удали или поправь запись в ALLOWLIST — она не матчит ни одного роута.\n');
}

if (hasError) process.exit(1);

console.log(
  `✓ check:contracts — ${onContractsCount}/${routes.length} роутов /api/v1 на @vire/api-contracts, ` +
    `${allowlistedCount} в allowlist (${rules.length} записей)`,
);
