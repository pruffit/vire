import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GLASS_GREEN_MAX } from '../design/glass-budget';

const APP = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../App.tsx'),
  'utf8',
);

/**
 * Правило подавления бэкдропа считает `backdropAllowed` (покрыто в design-system.test.ts), но
 * доедет ли оно до материала — решает проводка в корне. Ошибка здесь не ловится ни typecheck,
 * ни контрактными тестами пакета: пропы совместимы по форме, и стекло просто перестаёт гаснуть.
 */
describe('политика стекла в корне', () => {
  it('провайдер получает обе настройки и правило подавления', () => {
    expect(APP).toContain('<VireGlassProvider');
    for (const prop of ['glassEnabled={glassEnabled}', 'reduceMotion={reduceMotion}', 'backdropAllowed={allowed}']) {
      expect(APP, `проп ${prop} не передан`).toContain(prop);
    }
  });

  it('правило пересчитывается при открытии листа', () => {
    // Забыть `openSheets` в зависимостях — и лист открывается, а бэкдроп под ним не гаснет:
    // колбэк остаётся замкнутым на ноль листов.
    const deps = APP.slice(APP.indexOf('const allowed = useCallback('));
    expect(deps.slice(0, deps.indexOf('\n  );'))).toContain('[glassEnabled, openSheets]');
  });
});

/**
 * Бюджет поверхностей измерен у нас (`docs/vireglass/benchmarks/`), но то же число зашито в
 * dev-предупреждение реестра внутри пакета. Импортом их не свести: подпуть нативный. Значит
 * сверяем текстом — иначе следующий замер поднимет наш порог, а предупреждение останется на старом.
 */
describe('бюджет поверхностей', () => {
  it('порог совпадает с тем, что держит пакет', () => {
    const registry = readFileSync(
      resolve(
        dirname(createRequire(import.meta.url).resolve('vireglass/package.json')),
        'src/native/surface-registry.ts',
      ),
      'utf8',
    );
    const inPackage = registry.match(/GLASS_GREEN_MAX = (\d+)/)?.[1];
    expect(inPackage).toBe(String(GLASS_GREEN_MAX));
  });
});
