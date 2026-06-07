import ffmpeg from 'fluent-ffmpeg';
import { readdirSync } from 'node:fs';
import path from 'node:path';

// fluent-ffmpeg ищет ffmpeg/ffprobe в системном PATH. В Docker-проде они ставятся
// через apk (см. apps/worker/Dockerfile). Для локальной разработки (особенно на
// Windows, где ffmpeg обычно не установлен) подхватываем бандл-бинарники из
// ffmpeg-static / ffprobe-static. Это devDependencies — в прод-сборку
// (pnpm install --prod) они не попадают, и там используется системный ffmpeg.
try {
  const ffmpegMod = await import('ffmpeg-static');
  const ffmpegPath = (ffmpegMod.default ?? ffmpegMod) as unknown as string | null;
  if (typeof ffmpegPath === 'string' && ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

  const ffprobeMod = await import('ffprobe-static');
  const ffprobePath = (ffprobeMod.default?.path ?? ffprobeMod.path) as string | undefined;
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
} catch {
  // Бандл-бинарники не установлены (например, прод-сборка) — полагаемся на
  // системный ffmpeg/ffprobe в PATH.
}

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
      .audioCodec('aac')
      .audioBitrate('192k')
      .addOutputOptions([
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segmentPattern,
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
      const pcm = Buffer.concat(chunks);
      const totalSamples = Math.floor(pcm.length / 2); // 16-bit = 2 байта
      const bucketSize = Math.max(1, Math.floor(totalSamples / numPeaks));
      const peaks: number[] = [];

      for (let i = 0; i < numPeaks; i++) {
        let max = 0;
        const start = i * bucketSize;
        for (let j = 0; j < bucketSize; j++) {
          const byteIdx = (start + j) * 2;
          if (byteIdx + 1 < pcm.length) {
            const sample = Math.abs(pcm.readInt16LE(byteIdx)) / 32768;
            if (sample > max) max = sample;
          }
        }
        peaks.push(Number(max.toFixed(4)));
      }

      resolve(peaks);
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
