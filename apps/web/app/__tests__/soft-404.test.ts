import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// app/__tests__/ -> app/
const APP_DIR = fileURLToPath(new URL('..', import.meta.url));

// dashboard/** — авторизованная зона артиста, не индексируется поисковиками
// (нет в sitemap/публичных ссылках); soft-404 там не несёт SEO-риска, поэтому
// оставлен как принятый долг (см. docs/roadmap/TODO.md).
const EXEMPT = [path.join(APP_DIR, 'dashboard')];

function collectPageAndLayoutFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'api') continue;
      out.push(...collectPageAndLayoutFiles(full));
    } else if (entry.name === 'page.tsx' || entry.name === 'layout.tsx') {
      out.push(full);
    }
  }
  return out;
}

function callsNotFound(file: string): boolean {
  return /\bnotFound\(\)/.test(readFileSync(file, 'utf8'));
}

/** loading.tsx в ЛЮБОМ каталоге-предке (вкл. собственный) оборачивает файл в Suspense. */
function hasLoadingAncestor(file: string): string | null {
  let dir = path.dirname(file);
  while (dir.startsWith(APP_DIR)) {
    const candidate = path.join(dir, 'loading.tsx');
    if (existsSync(candidate)) return candidate;
    if (dir === APP_DIR) break;
    dir = path.dirname(dir);
  }
  return null;
}

describe('soft-404: notFound() должен реально отдавать HTTP 404', () => {
  // Next стримит содержимое под loading.tsx (Suspense): к моменту, когда вложенный
  // notFound() срабатывает, шелл с 200 уже отправлен и статус необратим (см. TODO.md).
  // Инвариант — ни у одной публичной страницы, вызывающей notFound(), не должно быть
  // loading.tsx среди предков (включая собственный сегмент).
  it('ни один публичный page.tsx/layout.tsx с notFound() не стоит под loading.tsx', () => {
    const offenders = collectPageAndLayoutFiles(APP_DIR)
      .filter((file) => !EXEMPT.some((ex) => file.startsWith(ex)))
      .filter(callsNotFound)
      .map((file) => ({ file: path.relative(APP_DIR, file), loading: hasLoadingAncestor(file) }))
      .filter((r) => r.loading !== null)
      .map((r) => `${r.file} <- ${path.relative(APP_DIR, r.loading!)}`);

    expect(offenders).toEqual([]);
  });
});
