#!/usr/bin/env node
/**
 * Барьер границ @vire/core (план миграции, волна 0.2):
 *   1. platform/** не импортирует music/**  — Core не знает о доменных сущностях продукта.
 *   2. ни один файл core не импортирует @vire/db, next, react — core остаётся чистым TS.
 *
 * Направление music/** → platform/** разрешено: домен стоит поверх платформы.
 * Запуск: node scripts/check-layers.mjs   (cwd = packages/core)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const FORBIDDEN_PACKAGES = [/^@vire\/db(\/|$)/, /^next(\/|$)/, /^react(-dom)?(\/|$)/];

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** 'platform' | 'music' | null (корень: errors.ts, jobs.ts, index.ts — общее ядро) */
function layerOf(absPath) {
  const rel = relative(SRC, absPath).replaceAll('\\', '/');
  return rel.startsWith('platform/') ? 'platform' : rel.startsWith('music/') ? 'music' : null;
}

const violations = [];
const files = existsSync(SRC) ? walk(SRC) : [];

if (files.length === 0) {
  console.error(`check-layers: нет файлов в ${SRC}`);
  process.exit(2);
}

for (const file of files) {
  const layer = layerOf(file);
  const rel = relative(SRC, file).replaceAll('\\', '/');
  const src = readFileSync(file, 'utf8');

  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    if (!spec) continue;

    if (FORBIDDEN_PACKAGES.some((re) => re.test(spec))) {
      violations.push(`${rel}  →  '${spec}'  (core не зависит от фреймворка и БД)`);
      continue;
    }
    if (!spec.startsWith('.')) continue;

    const target = resolve(dirname(file), spec);
    if (layer === 'platform' && layerOf(target) === 'music') {
      violations.push(`${rel}  →  '${spec}'  (platform не знает о music)`);
    }
  }
}

if (violations.length > 0) {
  console.error('\n✗ Нарушены границы слоёв @vire/core:\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error('\n  Общее для платформы и домена — в platform/**; доменное — в music/**.\n');
  process.exit(1);
}

console.log(`✓ check:layers OK — границы platform/music целы (${files.length} файлов)`);
