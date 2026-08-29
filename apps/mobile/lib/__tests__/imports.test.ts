import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Барьер сборки бандла. Метро разбирает граф модулей статически, и часть ошибок не видна
 * ни `tsc`, ни тестам — только при бандлинге, то есть уже на устройстве.
 *
 * Реальный случай: импорт `clampRestoredQueueIndex` из корневого барреля `@vire/core`
 * утянул весь пакет, включая `@vire/i18n` с `import(\`../messages/${'${locale}'}/…\`)` —
 * динамическим импортом по шаблону, который Metro разобрать не может. Бандл падал
 * целиком, хотя typecheck и 294 теста были зелёными.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', 'android', 'ios', '.expo', 'dist', '.cxx', 'assets', 'design']);

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

describe('импорты мобильного бандла', () => {
  it('никто не тянет корневой баррель @vire/core — он утаскивает @vire/i18n и валит Metro', () => {
    const offenders: string[] = [];
    // Ровно `@vire/core`, но не `@vire/core/playback/queue` и прочие узкие подпути.
    const rootBarrel = /from\s+['"]@vire\/core['"]/;

    for (const file of sources(ROOT)) {
      if (rootBarrel.test(readFileSync(file, 'utf8'))) {
        offenders.push(relative(ROOT, file).replace(/\\/g, '/'));
      }
    }

    expect(offenders, 'импортируй узкий подпуть: @vire/core/playback/<модуль>').toEqual([]);
  });
});
