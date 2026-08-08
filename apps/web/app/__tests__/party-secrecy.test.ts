import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARTY_PATH } from '@/lib/party';

// app/__tests__/ -> app/
const APP_DIR = fileURLToPath(new URL('..', import.meta.url));
const WEB_DIR = path.join(APP_DIR, '..');
const SEGMENT = PARTY_PATH.replace(/^\//, '');

/**
 * Секретен именно вход: путь не должен утечь ни в sitemap, ни в robots.txt
 * (`Disallow: /nrvz914` выдал бы его ровно так же, как ссылка).
 */
describe('секретность входа вечеринки', () => {
  it.each(['app/robots.ts', 'lib/sitemap.ts'])('%s не упоминает секретный путь', (file) => {
    const src = readFileSync(path.join(WEB_DIR, file), 'utf8');
    expect(src).not.toContain(SEGMENT);
  });

  it('страница входа помечена noindex', () => {
    const src = readFileSync(path.join(APP_DIR, '[locale]', '(listener)', SEGMENT, 'layout.tsx'), 'utf8');
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});
