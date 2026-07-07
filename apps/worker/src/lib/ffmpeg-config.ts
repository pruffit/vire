import ffmpeg from 'fluent-ffmpeg';

// fluent-ffmpeg ищет ffmpeg/ffprobe в системном PATH. В Docker-проде они ставятся
// через apk (см. apps/worker/Dockerfile). Для локальной разработки (особенно на
// Windows, где ffmpeg обычно не установлен) подхватываем бандл-бинарники из
// ffmpeg-static / ffprobe-static. Это devDependencies — в прод-сборку
// (pnpm install --prod) они не попадают, и там используется системный ffmpeg.
//
// Настройка пути — глобальный singleton fluent-ffmpeg (setFfmpegPath). Вынесена в
// отдельный side-effect модуль, чтобы её выполнял ЛЮБОЙ потребитель ffmpeg
// (транскодинг И декодер аудио-анализа/жанра), а не только тот, кто первым
// импортнул ffmpeg.ts. Иначе на Windows-локалке анализ жанра/BPM падал бы с
// «Cannot find ffmpeg» ещё до сохранения результата — джоба виснет, спиннер
// крутится бесконечно.
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
