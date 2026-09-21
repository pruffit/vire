import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(resolve(HERE, p), 'utf8'));

const app = read('../../package.json');
const local = read('../../modules/glass-lens/expo-module.config.json');

/**
 * Пакет `vireglass` везёт СВОЙ Expo-модуль под тем же именем и тем же Kotlin-пакетом
 * (`expo.modules.glasslens.GlassLensModule`), что и локальный `modules/glass-lens`. Автолинковка
 * подхватывает оба, и сборка Android падает на дублирующихся классах — а typecheck, тесты и CI
 * этого не видят, потому что Android здесь никто не собирает.
 */
describe('автолинковка Expo', () => {
  it('нативный модуль стекла приходит ровно из одного места', () => {
    expect(local.android.modules).toEqual(['expo.modules.glasslens.GlassLensModule']);
    if (app.dependencies?.vireglass === undefined) return;
    expect(app.expo?.autolinking?.exclude ?? []).toContain('vireglass');
  });
});
