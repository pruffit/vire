#!/usr/bin/env node
/**
 * Статическая проверка инварианта роутинга Next.js:
 *   «You cannot use different slug names for the same dynamic path».
 *
 * Next запрещает на одном уровне пути два РАЗНЫХ имени динамического сегмента
 * (напр. `[id]` и `[releaseId]` как соседи). Эта ошибка кидается ТОЛЬКО в
 * рантайме (next build её пропускает), валит каждый запрос и кладёт прод.
 * Скрипт ловит её до сборки — детерминированно, без запуска сервера.
 *
 * Запуск: node scripts/check-route-slugs.mjs   (cwd = apps/web)
 * Exit 1 при конфликте, печатает родителя и конфликтующие имена.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

/** Имя динамического сегмента или null. `[id]`→id, `[...s]`→s, `[[...s]]`→s. */
function dynamicSlugName(segment) {
  const m = segment.match(/^\[\[?\.{0,3}([^\]]+?)\]?\]$/);
  return m ? m[1] : null;
}

const conflicts = [];

function walk(dir, routePath) {
  const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());

  // Имена динамических слагов среди ПРЯМЫХ детей этого уровня.
  const slugByName = new Map(); // slugName -> segment (для сообщения)
  for (const e of entries) {
    // Группы (..), параллельные @slot, приватные _dir — не сегменты пути.
    if (e.name.startsWith('(') || e.name.startsWith('@') || e.name.startsWith('_')) continue;
    const slug = dynamicSlugName(e.name);
    if (slug) slugByName.set(slug, e.name);
  }
  if (slugByName.size > 1) {
    conflicts.push({ path: routePath || '/', segments: [...slugByName.values()] });
  }

  for (const e of entries) {
    if (e.name.startsWith('_')) continue;
    walk(join(dir, e.name), `${routePath}/${e.name}`);
  }
}

if (!existsSync(APP_DIR)) {
  console.error(`check-route-slugs: app dir not found at ${APP_DIR}`);
  process.exit(2);
}

walk(APP_DIR, '');

if (conflicts.length > 0) {
  console.error('\n✗ Конфликт имён динамических сегментов роутинга (Next.js упадёт в рантайме):\n');
  for (const c of conflicts) {
    console.error(`  ${c.path}/  →  ${c.segments.join('  vs  ')}`);
  }
  console.error('\n  Переименуй сегменты к одному имени (напр. оба `[releaseId]`).\n');
  process.exit(1);
}

console.log('✓ route slugs OK — конфликтов имён динамических сегментов нет');
