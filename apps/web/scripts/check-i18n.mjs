#!/usr/bin/env node
/**
 * Защита от регресса локализации: кириллица в JSX-тексте/title/label/placeholder/
 * aria-label/toast(...) внутри локализованной зоны (app/[locale]/**, components/**
 * кроме components/admin/**) должна уйти в словари packages/i18n/messages.
 *
 * Срез J: режим ПАДЕНИЯ — любая находка вне ALLOWLIST валит скрипт (exit 1).
 *
 * Запуск: node scripts/check-i18n.mjs   (cwd = apps/web)
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const CYRILLIC = /[а-яёА-ЯЁ]/;

const TARGET_DIRS = [join(WEB_DIR, 'app', '[locale]'), join(WEB_DIR, 'components')];

// /design — внутренняя витрина дизайн-системы для разработки (noindex, не часть продукта
// для конечного пользователя): переводить дизайн-жаргон демо смысла не имеет.
const ALLOWLIST_PREFIXES = [join('app', '[locale]', '(listener)', 'design') + sep];

function isAllowlisted(relPath) {
  return ALLOWLIST_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'admin') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.tsx') && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Убрать комментарии и import/export строки — не текст, который видит пользователь. */
function stripNoise(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/^import .*$/gm, '');
}

const JSX_TEXT_RE = />([^<{}\n]*[а-яёА-ЯЁ][^<{}\n]*)</g;
const ATTR_RE = /\b(title|label|placeholder|aria-label)=["']([^"']*[а-яёА-ЯЁ][^"']*)["']/g;
const TOAST_RE = /\btoast(?:\.(error|success))?\(\s*["'`]([^"'`]*[а-яёА-ЯЁ][^"'`]*)["'`]/g;

const findings = [];

for (const dir of TARGET_DIRS) {
  if (!existsSync(dir)) continue;
  for (const file of collectFiles(dir)) {
    const raw = readFileSync(file, 'utf8');
    const src = stripNoise(raw);
    if (!CYRILLIC.test(src)) continue;
    const rel = relative(WEB_DIR, file);
    if (isAllowlisted(rel)) continue;
    let m;
    while ((m = JSX_TEXT_RE.exec(src))) findings.push({ file: rel, kind: 'jsx-text', snippet: m[1].trim() });
    while ((m = ATTR_RE.exec(src))) findings.push({ file: rel, kind: `attr:${m[1]}`, snippet: m[2].trim() });
    while ((m = TOAST_RE.exec(src))) findings.push({ file: rel, kind: 'toast', snippet: m[2].trim() });
  }
}

if (findings.length === 0) {
  console.log('✓ check:i18n — кириллицы в локализованной зоне не найдено');
  process.exit(0);
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.file)) byFile.set(f.file, []);
  byFile.get(f.file).push(f);
}

console.log(`✗ check:i18n — ${findings.length} находок в ${byFile.size} файлах:\n`);
for (const [file, items] of byFile) {
  console.log(`  ${file}`);
  for (const item of items.slice(0, 5)) {
    console.log(`    [${item.kind}] ${item.snippet.slice(0, 60)}`);
  }
  if (items.length > 5) console.log(`    …и ещё ${items.length - 5}`);
}
console.log('\nПеренос текста в packages/i18n/messages — строки только в словарях, ru и en одновременно.');
process.exit(1);
