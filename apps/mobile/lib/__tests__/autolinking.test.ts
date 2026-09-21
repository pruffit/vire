import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(resolve(HERE, p), 'utf8'));

const app = read('../../package.json');

/** Нативный модуль стекла приезжает из пакета. Своя копия под тем же Kotlin-пакетом
 *  `expo.modules.glasslens` задвоила бы автолинковку — разбор в `docs/features/mobile-app.md`. */
describe('автолинковка Expo', () => {
  it('нативный модуль стекла приходит ровно из одного места', () => {
    expect(existsSync(resolve(HERE, '../../modules/glass-lens'))).toBe(false);

    const from = createRequire(resolve(HERE, '../../package.json'));
    const pkgDir = dirname(from.resolve('vireglass/package.json'));
    const config = JSON.parse(readFileSync(resolve(pkgDir, 'expo-module.config.json'), 'utf8'));
    expect(config.android.modules).toEqual(['expo.modules.glasslens.GlassLensModule']);

    // Исключать пакет больше нечем: он теперь единственный источник модуля.
    expect(app.expo?.autolinking?.exclude ?? []).not.toContain('vireglass');
  });
});
