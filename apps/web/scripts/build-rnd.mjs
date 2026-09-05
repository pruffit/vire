#!/usr/bin/env node
/**
 * Сборка стенда VireGlass в `public/rnd/`.
 *
 * Стенд не React-страница: он не зависит от гидрации приложения и от его оболочки —
 * ровно как стенд на Android заменяет собой приложение. Пересборка — миллисекунды,
 * поэтому доводка оптики идёт правкой файла, а не четырёхминутным `next build`.
 *
 *   node scripts/build-rnd.mjs          # разовая сборка
 *   node scripts/build-rnd.mjs --watch  # пересборка на каждое изменение
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const web = join(dirname(fileURLToPath(import.meta.url)), '..');

const options = {
  entryPoints: [join(web, 'rnd-src', 'main.ts')],
  outfile: join(web, 'public', 'rnd', 'stand.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('стенд: слежу за изменениями');
} else {
  await esbuild.build(options);
}
