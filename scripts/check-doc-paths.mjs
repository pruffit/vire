#!/usr/bin/env node
/**
 * Проверка, что ссылки в документации никуда не проваливаются: пути к коду
 * в бэктиках и относительные markdown-ссылки между документами.
 *
 * Код переезжает — ссылка остаётся, и док начинает врать молча: ни typecheck,
 * ни lint его не читают. Так после i18n-рефакторинга 37 ссылок в 21 фичедоке
 * остались на путях без `[locale]`, а девять указывали на переименованные файлы.
 *
 * Журнал `docs/superpowers/plans|specs` не проверяется: он фиксирует состояние
 * на момент написания и задним числом не правится. Его индекс (README) — проверяется.
 *
 * Запуск: node scripts/check-doc-paths.mjs   (cwd = корень репо)
 * Exit 1 при битой ссылке, печатает файл:строку и цель.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['docs', 'README.md', 'CLAUDE.md'];
const SKIP_DIRS = new Set(['node_modules']);
/** Журнал процесса: пути внутри записей историчны, индекс — нет. */
const JOURNAL = /^docs[/\\]superpowers[/\\](plans|specs)[/\\]/;

/** Пути к коду в бэктиках: apps/…, packages/…, scripts/…, ops/… */
const PATH_RE = /`((?:apps|packages|scripts|ops)\/[^`\s]+)`/g;
/** Относительная markdown-ссылка на другой документ: [текст](путь.md#якорь) */
const LINK_RE = /\[[^\]]*\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g;

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
let codePaths = 0;
let docLinks = 0;

for (const entry of SCAN) {
  for (const file of markdownFiles(entry)) {
    const journal = JOURNAL.test(file);
    const lines = readFileSync(join(ROOT, file), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const at = { file: file.replace(/\\/g, '/'), line: i + 1 };
      if (!journal) {
        for (const [, raw] of line.matchAll(PATH_RE)) {
          const p = normalize(raw);
          if (!isCheckable(p)) continue;
          codePaths++;
          if (!existsSync(join(ROOT, p))) broken.push({ ...at, path: p });
        }
      }
      for (const [, target] of line.matchAll(LINK_RE)) {
        if (/^https?:/.test(target)) continue;
        docLinks++;
        if (!existsSync(resolve(dirname(join(ROOT, file)), target))) {
          broken.push({ ...at, path: target });
        }
      }
    });
  }
}

if (broken.length > 0) {
  console.error(`\nБитые ссылки в документации: ${broken.length}\n`);
  for (const b of broken) console.error(`  ${b.file}:${b.line}  →  ${b.path}`);
  console.error('\nЦель переехала, а ссылка осталась. Поправь путь или убери ссылку.\n');
  process.exit(1);
}

console.log(`check:doc-paths — ${codePaths} путей к коду и ${docLinks} ссылок между документами, все ведут в существующие файлы`);
