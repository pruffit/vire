import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(resolve(HERE, p), 'utf8'));

const app = read('../../package.json');
const local = read('../../modules/glass-lens/expo-module.config.json');

/** `vireglass` везёт свой Expo-модуль под тем же Kotlin-пакетом, что и локальный `glass-lens`;
 *  автолинковка берёт оба и Android падает на дублях — разбор в `docs/features/mobile-app.md`. */
describe('автолинковка Expo', () => {
  it('нативный модуль стекла приходит ровно из одного места', () => {
    expect(local.android.modules).toEqual(['expo.modules.glasslens.GlassLensModule']);

    // Условие — не запись в `dependencies`, а разрешимость пакета отсюда: транзитивно через
    // `@vire/vireglass` он доедет и без прямой зависимости, а автолинковка ищет по node_modules.
    const from = createRequire(resolve(HERE, '../../package.json'));
    let reachable = true;
    try {
      from.resolve('vireglass/package.json');
    } catch {
      reachable = false;
    }
    if (!reachable) return;

    expect(app.expo?.autolinking?.exclude ?? []).toContain('vireglass');
  });
});
