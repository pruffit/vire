#!/usr/bin/env node
// Скачивает ONNX-модель автоопределения жанра (Essentia discogs-effnet) в
// AUTO_GENRE_MODELS_DIR (по умолчанию apps/worker/models/, в .gitignore).
// Идемпотентно — уже скачанные файлы не перезаписывает.
//
// Голова genre_discogs400-discogs-effnet-1 существует только в TensorFlow (.pb),
// без ONNX-экспорта (проверено по essentia.upf.edu/models.html). Вместо неё
// используем embedding-модель в варианте с динамическим батчем — она отдаёт
// то же 400-классовое предсказание genre_discogs400 вторым выходом. Подробности —
// docs/features/auto-genre.md.

import { mkdirSync, existsSync, createWriteStream, renameSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = process.env.AUTO_GENRE_MODELS_DIR
  ? path.resolve(process.env.AUTO_GENRE_MODELS_DIR)
  : path.join(__dirname, '..', 'models');

const BASE_URL = 'https://essentia.upf.edu/models/feature-extractors/discogs-effnet';
const FILES = [
  { name: 'discogs-effnet-bsdynamic-1.onnx', url: `${BASE_URL}/discogs-effnet-bsdynamic-1.onnx` },
  { name: 'discogs-effnet-bsdynamic-1.json', url: `${BASE_URL}/discogs-effnet-bsdynamic-1.json` },
];

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Не удалось скачать ${url}: HTTP ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(dest));
}

async function main() {
  mkdirSync(modelsDir, { recursive: true });

  for (const file of FILES) {
    const dest = path.join(modelsDir, file.name);
    if (existsSync(dest)) {
      console.log(`[models:download] уже есть — ${file.name}`);
      continue;
    }
    console.log(`[models:download] качаю ${file.name}…`);
    const tmp = `${dest}.part`;
    await downloadFile(file.url, tmp);
    renameSync(tmp, dest);
    console.log(`[models:download] готово — ${file.name}`);
  }

  console.log(`[models:download] модели в ${modelsDir}`);
  console.log(
    '[models:download] лицензия MTG (CC BY-NC-ND 4.0) — некоммерческое использование, см. docs/features/auto-genre.md',
  );
}

main().catch((e) => {
  console.error('[models:download] ошибка:', e);
  process.exitCode = 1;
});
