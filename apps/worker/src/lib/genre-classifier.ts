import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { InferenceSession } from 'onnxruntime-node';
import { decodeMonoPcm } from './audio-analysis.js';
import { MEL_SAMPLE_RATE, MEL_NUM_BANDS, MEL_PATCH_SIZE, computeLogMelFrames, chunkIntoPatchBatches } from './mel-spectrogram.js';
import { mapDiscogsPredictionsToGenres, type GenreSuggestion } from './discogs-genre-map.js';
import { DISCOGS_400_LABELS } from './discogs-genre-labels.js';

// Классификация жанра через Essentia discogs-effnet (ONNX): устройство и маппинг,
// см. docs/features/auto-genre.md. Модель не в git, качается
// apps/worker/scripts/download-models.mjs (AUTO_GENRE_MODELS_DIR). Выключено
// (AUTO_GENRE) или модель не скачана: classifyTrackGenre возвращает null, не бросает.

const MODEL_FILE = 'discogs-effnet-bsdynamic-1.onnx';
// Сайдкар-JSON модели: поле "classes", те же 400 меток в том же порядке, что и
// DISCOGS_400_LABELS. Сверяем при инициализации, расхождение тихо даёт неверные жанры.
const LABELS_FILE = 'discogs-effnet-bsdynamic-1.json';
const MAX_ANALYSIS_SEC = 120;
const NUM_CLASSES = 400;

function modelsDir(): string {
  return process.env.AUTO_GENRE_MODELS_DIR ?? path.join(process.cwd(), 'models');
}

export function isAutoGenreEnabled(): boolean {
  return process.env.AUTO_GENRE === 'true' || process.env.AUTO_GENRE === '1';
}

/** Модель скачана в AUTO_GENRE_MODELS_DIR (apps/worker/scripts/download-models.mjs). */
export function modelsAvailable(): boolean {
  return existsSync(path.join(modelsDir(), MODEL_FILE));
}

/** Сверяет метки сайдкар-JSON с DISCOGS_400_LABELS поэлементно. Чистая функция,
 * принимает уже распарсенное значение поля "classes". */
export function labelsMatchModel(modelClasses: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(modelClasses) || modelClasses.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (modelClasses[i] !== expected[i]) return false;
  }
  return true;
}

async function verifyLabels(): Promise<boolean> {
  const jsonPath = path.join(modelsDir(), LABELS_FILE);
  try {
    const raw = await readFile(jsonPath, 'utf-8');
    const parsed = JSON.parse(raw) as { classes?: unknown };
    const ok = labelsMatchModel(parsed.classes, DISCOGS_400_LABELS);
    if (!ok) {
      console.error(
        '[genre-classifier] метки модели не совпадают с DISCOGS_400_LABELS (смещение порядка дало бы неверные жанры) — классификатор отключён:',
        jsonPath,
      );
    }
    return ok;
  } catch (e) {
    console.error('[genre-classifier] не удалось прочитать/сверить метки модели — классификатор отключён:', jsonPath, e);
    return false;
  }
}

// Кэшируем промис, не значение: иначе два джоба, стартовавшие до резолва, создали
// бы по своей ONNX-сессии (2x RAM на 1ГБ VPS). На ошибку init сбрасываем для повтора.
let sessionPromise: Promise<InferenceSession> | null = null;
let labelsOkPromise: Promise<boolean> | null = null;

function getSession(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import('onnxruntime-node');
      return ort.InferenceSession.create(path.join(modelsDir(), MODEL_FILE));
    })();
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

function getLabelsOk(): Promise<boolean> {
  if (!labelsOkPromise) labelsOkPromise = verifyLabels();
  return labelsOkPromise;
}

// Модель отдаёт 2 выхода (предсказания + эмбеддинг), матчим по размерности тензора,
// не по имени узла (имена ONNX-экспорта не документированы как стабильный контракт).
function pickOutputByLastDim(
  results: InferenceSession.OnnxValueMapType,
  expectedDim: number,
): Float32Array {
  for (const value of Object.values(results)) {
    const dims = (value as { dims?: readonly number[] }).dims;
    if (dims && dims[dims.length - 1] === expectedDim) {
      return (value as { data: Float32Array }).data;
    }
  }
  throw new Error(`genre-classifier: не найден выходной тензор с последней размерностью ${expectedDim}`);
}

async function runBatch(model: InferenceSession, data: Float32Array, numPatches: number): Promise<Float32Array> {
  const ort = await import('onnxruntime-node');
  const tensor = new ort.Tensor('float32', data, [numPatches, MEL_PATCH_SIZE, MEL_NUM_BANDS]);
  const inputName = model.inputNames[0];
  const results = await model.run({ [inputName]: tensor });
  return pickOutputByLastDim(results, NUM_CLASSES);
}

// Общее ядро classifyTrackGenre/classifyTrackGenreOnDemand, отличаются обработкой ошибки.
async function classify(filePath: string): Promise<GenreSuggestion[] | null> {
  if (!(await getLabelsOk())) return null;

  const pcm = await decodeMonoPcm(filePath, MEL_SAMPLE_RATE, MAX_ANALYSIS_SEC);
  const frames = await computeLogMelFrames(pcm);
  const patchBatches = chunkIntoPatchBatches(frames);
  if (patchBatches.length === 0) return null;

  const model = await getSession();

  // Усредняем sigmoid-предсказания по всем патчам трека (агрегация по времени).
  const accumulated = new Float64Array(NUM_CLASSES);
  let totalPatches = 0;

  for (const { data, numPatches } of patchBatches) {
    const predictions = await runBatch(model, data, numPatches);
    for (let p = 0; p < numPatches; p++) {
      for (let c = 0; c < NUM_CLASSES; c++) accumulated[c] += predictions[p * NUM_CLASSES + c];
    }
    totalPatches += numPatches;
  }

  if (totalPatches === 0) return null;
  const averaged = new Float64Array(NUM_CLASSES);
  for (let c = 0; c < NUM_CLASSES; c++) averaged[c] = accumulated[c] / totalPatches;

  return mapDiscogsPredictionsToGenres(averaged);
}

/** Топ-5 жанров (genreEnum + confidence) либо null (выключено/нет модели/ошибка):
 *  никогда не блокирует переход трека в READY, ошибка только логируется. */
export async function classifyTrackGenre(filePath: string): Promise<GenreSuggestion[] | null> {
  if (!isAutoGenreEnabled()) return null;
  if (!modelsAvailable()) {
    console.warn('[genre-classifier] AUTO_GENRE включен, но модель не найдена в', modelsDir());
    return null;
  }

  try {
    return await classify(filePath);
  } catch (e) {
    console.error('[genre-classifier]', e);
    return null;
  }
}

/** Как classifyTrackGenre, но по требованию: AUTO_GENRE не проверяется, ошибки
 *  не глотаются, бросает, чтобы джоба упала штатно и пользователь её увидел. */
export async function classifyTrackGenreOnDemand(filePath: string): Promise<GenreSuggestion[]> {
  if (!modelsAvailable()) {
    const message = `[genre-classifier] модель не найдена в ${modelsDir()} — pnpm --filter @vire/worker models:download`;
    console.error(message);
    throw new Error(message);
  }

  const result = await classify(filePath);
  if (!result) throw new Error('genre-classifier: не удалось классифицировать трек (метки модели/декодирование)');
  return result;
}
