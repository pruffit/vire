import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, DrizzleTrackRepository } from '@vire/db';
import { TrackService, NotFoundError } from '@vire/core';
import { uploadBuffer } from '@/lib/s3';
import { transcodeQueue } from '@/lib/queue';
import { isUuid, parseAudioExt, parseCredits, parseTrackNumber, MAX_AUDIO_FILE_SIZE, validateMagicBytes, parseWavFormat, type AudioExt } from '@/lib/upload';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 20 uploads per hour per IP
  const rl = await rateLimit(clientKey(req, 'upload'), 20, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const artistRepo = new DrizzleArtistRepository(db);
  const artist = await artistRepo.findByUserId(session.user.id);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
  }

  const releaseId = formData.get('releaseId');
  const title = formData.get('title');
  const trackNumber = formData.get('trackNumber');
  const file = formData.get('file');

  if (
    typeof releaseId !== 'string' || !releaseId ||
    typeof title !== 'string' || !title ||
    typeof trackNumber !== 'string' ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!isUuid(releaseId)) {
    return NextResponse.json({ error: 'Invalid releaseId' }, { status: 400 });
  }

  const trackNum = parseTrackNumber(trackNumber);
  if (trackNum === null) {
    return NextResponse.json({ error: 'trackNumber must be a positive integer' }, { status: 400 });
  }

  const credits = parseCredits(formData.get('credits'));

  // Мастер принимаем в WAV / FLAC / MP3 — определяем по расширению.
  const ext = parseAudioExt(file.name);
  if (!ext) {
    return NextResponse.json({ error: 'Файл должен быть WAV, FLAC или MP3' }, { status: 400 });
  }

  if (file.size > MAX_AUDIO_FILE_SIZE) {
    return NextResponse.json({ error: 'Файл слишком большой (макс. 300 МБ)' }, { status: 413 });
  }

  // Читаем только начало файла (хватает для magic bytes и WAV-заголовка fmt),
  // не буферизуя весь файл ради валидации.
  const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (!validateMagicBytes(header, ext)) {
    return NextResponse.json({ error: 'Формат файла не соответствует расширению' }, { status: 400 });
  }

  // WAV принимаем только несжатый (PCM). Частоту/битность не ограничиваем —
  // 48 kHz / 24 бит тоже допустимы (рекомендация 44.1/16-24 — в форме).
  if (ext === 'wav') {
    const fmt = parseWavFormat(header);
    if (!fmt) {
      return NextResponse.json({ error: 'Не удалось прочитать заголовок WAV' }, { status: 400 });
    }
    if (!fmt.isPcm) {
      return NextResponse.json(
        { error: 'WAV должен быть несжатым (PCM / импульсно-кодовая модуляция)' },
        { status: 400 },
      );
    }
  }

  const trackId = crypto.randomUUID();
  const sourceKey = `tracks/${trackId}/source.${ext}`;
  const CONTENT_TYPE: Record<AudioExt, string> = {
    wav: 'audio/wav',
    flac: 'audio/flac',
    mp3: 'audio/mpeg',
  };
  const contentType = CONTENT_TYPE[ext];

  // Загружаем мастер в vault перед созданием записи в БД
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadBuffer(sourceKey, buffer, contentType);

  const service = new TrackService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    transcodeQueue,
  );

  const result = await service.createUpload({
    trackId,
    releaseId,
    artistProfileId: artist.id,
    title,
    trackNumber: trackNum,
    sourceKey,
    credits,
  });

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json({ error: result.error.message }, { status: 403 });
  }

  return NextResponse.json({ trackId, status: 'PROCESSING' }, { status: 201 });
}
