import './ffmpeg-config.js'; // side-effect: настраивает путь к ffmpeg/ffprobe
import ffmpeg from 'fluent-ffmpeg';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { peaksFromPcm } from './waveform.js';

export interface HlsResult {
  manifestPath: string;
  segmentPaths: string[];
}

export async function transcodeToHls(
  inputPath: string,
  outDir: string,
): Promise<HlsResult> {
  const manifestPath = path.join(outDir, 'index.m3u8');
  const segmentPattern = path.join(outDir, 'chunk_%03d.ts');

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      // +genpts — пересобрать презентационные таймстампы, если у исходника они
      // битые/смещённые/отсутствуют (частая причина «дыры» и залипания плеера).
      .inputOptions(['-fflags', '+genpts'])
      // Только аудио. У FLAC/MP3 часто встроена обложка ОТДЕЛЬНЫМ видео-потоком
      // (не attached_pic) — без -vn ffmpeg мапит её в HLS как видео-дорожку из
      // одного кадра, она зависает на PTS 0 и стопорит MediaSource → плеер
      // бесконечно грузится (bufferStalledError), хотя аудио целое. -vn убирает.
      .noVideo()
      .audioCodec('aac')
      .audioBitrate('192k')
      // Непрерывная аудио-дорожка без дыр в таймстампах: часть исходников
      // (ведущая тишина/смещение PTS, edit-list) давала gap в начале/потоке →
      // в плеере bufferStalledError/bufferSeekOverHole, залипание на 0:00.
      // aresample async=1 заполняет/подрезает разрывы, first_pts=0 ставит старт в ноль.
      // Для «чистых» файлов это практически no-op.
      .audioFilters('aresample=async=1:first_pts=0')
      .addOutputOptions([
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segmentPattern,
        // Нормализуем отрицательные таймстампы к нулю на уровне мьюксера TS.
        '-avoid_negative_ts', 'make_zero',
      ])
      .save(manifestPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err));
  });

  const segmentPaths = readdirSync(outDir)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => path.join(outDir, f));

  return { manifestPath, segmentPaths };
}

// Экспортирует аудио как сырой моно-PCM 8 kHz и считает пики по бакетам.
// Возвращает массив из `numPeaks` значений [0, 1].
export async function computeWaveformPeaks(
  inputPath: string,
  numPeaks = 200,
): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const proc = ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(8000)
      .format('s16le');

    proc.on('error', reject);
    proc.on('end', () => {
      resolve(peaksFromPcm(Buffer.concat(chunks), numPeaks));
    });

    const stream = proc.pipe();
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  });
}

export async function probeDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, meta) => {
      if (err) return reject(err);
      resolve(Math.round(meta.format.duration ?? 0));
    });
  });
}
