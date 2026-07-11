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
      // +genpts: пересобрать таймстампы, если у исходника они битые/отсутствуют.
      .inputOptions(['-fflags', '+genpts'])
      // -vn: FLAC/MP3 иногда несут обложку отдельным видео-потоком (не attached_pic),
      // без -vn ffmpeg мапит её как видео из одного кадра, зависающее на PTS 0
      // и стопорящее плеер (bufferStalledError).
      .noVideo()
      .audioCodec('aac')
      .audioBitrate('192k')
      // aresample async=1:first_pts=0 заполняет/подрезает разрывы таймстампов
      // исходника (ведущая тишина, edit-list), иначе плеер залипает на 0:00.
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
