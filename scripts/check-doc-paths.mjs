#!/usr/bin/env node
/**
 * Проверка, что пути к коду в документации ведут в существующие файлы.
 *
 * Доки ссылаются на код бэктиками (`apps/web/lib/format.ts`). Код переезжает —
 * ссылка остаётся, и док начинает врать молча: ни typecheck, ни lint его не читают.
 * Так после i18n-рефакторинга 37 ссылок в 21 фичедоке остались на путях без
 * `[locale]`, а девять указывали на переименованные файлы.
 *
 * `docs/superpowers/**` не проверяется: это журнал планов и спек, его пути
 * описывают состояние на момент написания и меняться задним числом не должны.
 *
 * Запуск: node scripts/check-doc-paths.mjs   (cwd = корень репо)
 * Exit 1 при битой ссылке, печатает файл:строку и путь.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['docs', 'README.md', 'CLAUDE.md'];
const SKIP_DIRS = new Set(['superpowers', 'node_modules']);

/** Пути к коду в бэктиках: apps/…, packages/…, scripts/…, ops/… */
const PATH_RE = /`((?:apps|packages|scripts|ops)\/[^`\s]+)`/g;

function markdownFiles(entry) {
  const abs = join(ROOT, entry);
  if (!existsSync(abs)) return [];
  if (entry.endsWith('.md')) return [entry];
  const out = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(...markdownFiles(join(entry, e.name)));
    } else if (e.name.endsWith('.md')) {
      out.push(join(entry, e.name));
    }
  }
  return out;
}

/** Расширения, по которым видно, что ссылаются на конкретный файл. */
const FILE_EXT = /\.(ts|tsx|mjs|js|jsx|kt|swift|json|css|md|yml|yaml|sql|sh|ps1)$/;

/**
 * Проверяем только ссылки на конкретный файл, лежащий в git. Мимо идут:
 * нотация множества (`{a,b}.ts`, `a|b`), плейсхолдеры (`<name>`), globs,
 * ссылки на каталог, файлы вне git (.env, артефакты сборки).
 */
function isCheckable(p) {
  if (/[*{}|<>]/.test(p)) return false;
  if (!FILE_EXT.test(p)) return false;
  if (/(^|\/)\.env/.test(p)) return false;
  if (/(^|\/)(target|\.cxx|dist|\.next|node_modules)\//.test(p)) return false;
  return true;
}

/** Хвостовая пунктуация и суффикс строк (`file.ts:63-65`) прилипают к пути. */
function normalize(p) {
  return p.replace(/:\d+(-\d+)?$/, '').replace(/[.,;:)]+$/, '');
}

const broken = [];

for (const entry of SCAN) {
  for (const file of markdownFiles(entry)) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const [, raw] of line.matchAll(PATH_RE)) {
        const p = normalize(raw);
        if (!isCheckable(p)) continue;
        if (!existsSync(join(ROOT, p))) {
          broken.push({ file: file.replace(/\\/g, '/'), line: i + 1, path: p });
        }
      }
    });
  }
}

if (broken.length > 0) {
  console.error(`\nБитые пути к коду в документации: ${broken.length}\n`);
  for (const b of broken) console.error(`  ${b.file}:${b.line}  →  ${b.path}`);
  console.error('\nКод переехал, а док остался. Поправь путь или убери ссылку.\n');
  process.exit(1);
}

console.log('check:doc-paths — все пути к коду в документации существуют');
