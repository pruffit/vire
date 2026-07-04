import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { InferenceSession } from 'onnxruntime-node';
import { decodeMonoPcm } from './audio-analysis.js';
import { MEL_SAMPLE_RATE, MEL_NUM_BANDS, MEL_PATCH_SIZE, computeLogMelFrames, chunkIntoPatchBatches } from './mel-spectrogram.js';
import { mapDiscogsPredictionsToGenres, type GenreSuggestion } from './discogs-genre-map.js';
import { DISCOGS_400_LABELS } from './discogs-genre-labels.js';

// Классификация жанра по треку через Essentia discogs-effnet.
//
// Модели essentia.upf.edu публикуют отдельно embedding-модель (discogs-effnet) и
// лёгкую "классификационную голову" genre_discogs400 поверх неё — так задумано
// изначально этой фичи. На практике голова genre_discogs400-discogs-effnet-1
// экспортирована ТОЛЬКО в TensorFlow (.pb), ONNX-версии у неё нет (проверено по
// essentia.upf.edu/models.html — model_types головы не включает onnx). Зато сама
// embedding-модель в ONNX-варианте с динамическим батчем (discogs-effnet-bsdynamic-1.onnx)
// уже отдаёт top-400 предсказания genre_discogs400 вторым выходом (PartitionedCall:0) —
// она обучалась на той же 400-классовой Discogs-задаче. Поэтому используем ОДНУ эту
// модель и её "родной" выход предсказаний, отдельная голова не нужна.
//
// Модель не в git — скачивается apps/worker/scripts/download-models.mjs (AUTO_GENRE_MODELS_DIR).
// За фичефлагом AUTO_GENRE: выключен или модель не скачана → classifyTrackGenre
// возвращает null (не бросает), пайплайн транскодинга это молча пропускает.

const MODEL_FILE = 'discogs-effnet-bsdynamic-1.onnx';
// Сайдкар-JSON модели (скачивается вместе с .onnx в download-models.mjs) — его
// поле "classes" содержит те же 400 меток в том же порядке, что и наш захардкоженный
// DISCOGS_400_LABELS. Сверяем при инициализации: расхождение (смещение порядка)
// тихо даёт неверные жанры, а не падение.
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

/** Сверяет метки из сайдкар-JSON модели с DISCOGS_400_LABELS: длина и поэлементно
 * по порядку. Чистая функция — принимает уже распарсенное значение поля "classes". */
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

// Кэшируем сам промис (не итоговое значение) — concurrency воркера 2, без этого
// два джоба, стартовавшие до резолва, создали бы по своей ONNX-сессии (~2x RAM
// на 18МБ модели на VPS с 1ГБ). На ошибку init сбрасываем, чтобы следующая
// джоба могла повторить попытку, а не виснуть на отклонённом промисе навсегда.
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

// Модель отдаёт два выхода (400-классовые предсказания + 1280-мерный эмбеддинг);
// матчим нужный по последней размерности тензора, а не по имени узла — имена
// ONNX-экспорта (PartitionedCall:0/1) не документированы как стабильный контракт.
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

/**
 * Классифицирует жанр трека по аудиофайлу. Возвращает топ-5 предложений
 * (наши genreEnum-значения с нормализованным confidence) либо null, если
 * фича выключена, модель не скачана или что-то пошло не так — ошибка НЕ
 * блокирует переход трека в READY, только логируется.
 */
export async function classifyTrackGenre(filePath: string): Promise<GenreSuggestion[] | null> {
  if (!isAutoGenreEnabled()) return null;
  if (!modelsAvailable()) {
    console.warn('[genre-classifier] AUTO_GENRE включен, но модель не найдена в', modelsDir());
    return null;
  }

  try {
    // Проверяем метки до тяжёлого декода/FFT — при расхождении нет смысла тратить CPU.
    if (!(await getLabelsOk())) return null;

    const pcm = await decodeMonoPcm(filePath, MEL_SAMPLE_RATE, MAX_ANALYSIS_SEC);
    const frames = await computeLogMelFrames(pcm);
    const patchBatches = chunkIntoPatchBatches(frames);
    if (patchBatches.length === 0) return null;

    const model = await getSession();

    // Усредняем sigmoid-предсказания по всем патчам трека — простая и устойчивая
    // агрегация по времени.
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
  } catch (e) {
    console.error('[genre-classifier]', e);
    return null;
  }
}
