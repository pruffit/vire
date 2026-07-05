#!/usr/bin/env node
// Скачивает ONNX-модель автоопределения жанра (Essentia discogs-effnet) в
// AUTO_GENRE_MODELS_DIR (по умолчанию apps/worker/models/, в .gitignore).
// Идемпотентно — файлы с верной чек-суммой не перекачивает. Гоняется и на
// build-time прод-образа воркера (apps/worker/Dockerfile), поэтому retry на
// сетевые сбои и pinned SHA-256 (supply chain: бинарник уходит в GHCR).
//
// Голова genre_discogs400-discogs-effnet-1 существует только в TensorFlow (.pb),
// без ONNX-экспорта (проверено по essentia.upf.edu/models.html). Вместо неё
// используем embedding-модель в варианте с динамическим батчем — она отдаёт
// то же 400-классовое предсказание genre_discogs400 вторым выходом. Подробности —
// docs/features/auto-genre.md.

import { mkdirSync, existsSync, createWriteStream, renameSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = process.env.AUTO_GENRE_MODELS_DIR
  ? path.resolve(process.env.AUTO_GENRE_MODELS_DIR)
  : path.join(__dirname, '..', 'models');

const BASE_URL = 'https://essentia.upf.edu/models/feature-extractors/discogs-effnet';
const FILES = [
  {
    name: 'discogs-effnet-bsdynamic-1.onnx',
    url: `${BASE_URL}/discogs-effnet-bsdynamic-1.onnx`,
    sha256: 'a280825b334797cf677939db8cd5762c0392aedd0ca6415dbc1cd083f045e43c',
  },
  {
    name: 'discogs-effnet-bsdynamic-1.json',
    url: `${BASE_URL}/discogs-effnet-bsdynamic-1.json`,
    sha256: 'a2e85b2e7372d5f8e0f35bdd6aeae1139f101087d183d0b2fb60b0ea0f01a0ff',
  },
];

const ATTEMPTS = 3;
const BACKOFF_MS = [2_000, 5_000];

function sha256Of(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Не удалось скачать ${url}: HTTP ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(dest));
}

async function fetchVerified(file, dest) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const tmp = `${dest}.part`;
    try {
      await downloadFile(file.url, tmp);
      const actual = sha256Of(tmp);
      if (actual !== file.sha256) {
        throw new Error(`SHA-256 не совпала для ${file.name}: ожидали ${file.sha256}, получили ${actual}`);
      }
      renameSync(tmp, dest);
      return;
    } catch (e) {
      rmSync(tmp, { force: true });
      if (attempt === ATTEMPTS) throw e;
      const delay = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS.at(-1);
      console.warn(`[models:download] попытка ${attempt}/${ATTEMPTS} не удалась (${e.message}), повтор через ${delay / 1000}с…`);
      await sleep(delay);
    }
  }
}

async function main() {
  mkdirSync(modelsDir, { recursive: true });

  for (const file of FILES) {
    const dest = path.join(modelsDir, file.name);
    if (existsSync(dest)) {
      if (sha256Of(dest) === file.sha256) {
        console.log(`[models:download] уже есть — ${file.name}`);
        continue;
      }
      console.warn(`[models:download] ${file.name} на диске битый/устаревший — перекачиваю`);
    }
    console.log(`[models:download] качаю ${file.name}…`);
    await fetchVerified(file, dest);
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
