#!/usr/bin/env node
/**
 * Барьер против возврата флейка `turbo run test`.
 *
 * Vitest сам параллелит файлы внутри пакета (пул forks, до N-1 воркеров).
 * Turbo поверх этого параллелит ПАКЕТЫ, и произведение двух слоёв ничем не
 * ограничено: 10 пакетов x 7 воркеров = 70 процессов на 8 ядер (на 2-ядерном
 * раннере CI — 10 на 2). Ядер не хватает, тесты не укладываются в testTimeout
 * и падают с «Test timed out in 5000ms» — набор плавает от прогона к прогону.
 *
 * Замер: turbo default — 5/5 прогонов упали; --concurrency=1 — 0/3, при той же
 * длительности (~134с). Подробности и матрица — docs/foundation/TECHNICAL_DEBT.md.
 *
 * Инвариант: корневой скрипт `test` ограничивает конкуренцию turbo, а workflow'ы
 * зовут именно его, а не `turbo run test` напрямую.
 *
 * Запуск: node scripts/check-test-concurrency.mjs   (cwd = корень репозитория)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

const testScript = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts?.test ?? '';

if (!/\bturbo\b/.test(testScript)) {
  problems.push(`package.json → scripts.test не вызывает turbo: ${JSON.stringify(testScript)}`);
} else {
  const limit = testScript.match(/--concurrency[= ]([^\s"']+)/);
  if (!limit) {
    problems.push(
      `package.json → scripts.test без --concurrency: ${JSON.stringify(testScript)}\n` +
      `    Без ограничения параллелизм turbo складывается с параллелизмом vitest.`,
    );
  } else if (!/^\d+$/.test(limit[1]) || Number(limit[1]) < 1) {
    // Проценты ("50%") тоже допустимы для turbo, но здесь нужен предсказуемый
    // потолок: доля от числа ядер на 2-ядерном раннере снова даёт переподписку.
    problems.push(`package.json → scripts.test: --concurrency=${limit[1]} должен быть целым >= 1`);
  }
}

for (const wf of ['ci.yml', 'deploy.yml']) {
  const path = join(ROOT, '.github', 'workflows', wf);
  if (!existsSync(path)) continue;
  const yml = readFileSync(path, 'utf8');
  for (const [i, line] of yml.split('\n').entries()) {
    // Комментарии не считаем: они как раз объясняют, почему так нельзя.
    if (/^\s*#/.test(line)) continue;
    if (/run:\s*.*turbo\s+run\s+test\b/.test(line) && !/--concurrency/.test(line)) {
      problems.push(
        `.github/workflows/${wf}:${i + 1} зовёт turbo run test напрямую без --concurrency\n` +
        `    Используй \`pnpm test\` — лимит живёт в корневом package.json.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('✗ check:test-concurrency — параллелизм тестов не ограничен:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nПочему это важно: docs/foundation/TECHNICAL_DEBT.md → «turbo run test флейкал».');
  process.exit(1);
}

console.log('✓ check:test-concurrency — параллелизм turbo ограничен, workflow\'ы зовут pnpm test');
