import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./nav.tsx', import.meta.url)), 'utf8');

describe('Nav', () => {
  it('не содержит центральных контентных ссылок (ушли в сайдбар/футер)', () => {
    expect(src).not.toMatch(/href="\/feed"/);
    expect(src).not.toMatch(/>Артисты</);
    expect(src).not.toMatch(/>Релизы</);
  });
  it('сохраняет поиск и профиль', () => {
    expect(src).toMatch(/NavSearch/);
    expect(src).toMatch(/href="\/profile"/);
  });
});
