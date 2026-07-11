import ffmpeg from 'fluent-ffmpeg';

// fluent-ffmpeg ищет ffmpeg/ffprobe в PATH. В Docker-проде они ставятся через apk;
// локально (особенно на Windows) подхватываем бандл-бинарники ffmpeg-static/
// ffprobe-static (devDependencies, в прод-сборку не попадают). Отдельный
// side-effect модуль, а не код в ffmpeg.ts, чтобы путь настраивал любой потребитель
// ffmpeg (транскодинг и декодер аудио-анализа/жанра), не только тот, кто первым
// импортнул ffmpeg.ts.
try {
  const ffmpegMod = await import('ffmpeg-static');
  const ffmpegPath = (ffmpegMod.default ?? ffmpegMod) as unknown as string | null;
  if (typeof ffmpegPath === 'string' && ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

  const ffprobeMod = await import('ffprobe-static');
  const ffprobePath = (ffprobeMod.default?.path ?? ffprobeMod.path) as string | undefined;
  if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
} catch {
  // Бандл-бинарники не установлены (прод-сборка): полагаемся на системный ffmpeg/ffprobe.
}
