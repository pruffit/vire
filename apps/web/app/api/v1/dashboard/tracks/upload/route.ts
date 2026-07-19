import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository, DrizzleTrackRepository } from '@vire/db';
import { TrackService, NotFoundError } from '@vire/core';
import { audioStorage } from '@/lib/file-storage';
import { getActiveArtist } from '@/lib/active-artist';
import { transcodeQueue } from '@/lib/queue';
import { isUuid, parseAudioExt, parseCredits, parseTrackNumber, MAX_AUDIO_FILE_SIZE, validateMagicBytes } from '@/lib/upload';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit(clientKey(req, 'upload'), 20, 3600);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const artist = await getActiveArtist(session.user.id, req);
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

  const ext = parseAudioExt(file.name);
  if (!ext) {
    return NextResponse.json({ error: 'Файл должен быть WAV, FLAC или MP3' }, { status: 400 });
  }

  if (file.size > MAX_AUDIO_FILE_SIZE) {
    return NextResponse.json({ error: 'Файл слишком большой (макс. 300 МБ)' }, { status: 413 });
  }

  const header = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (!validateMagicBytes(header, ext)) {
    return NextResponse.json({ error: 'Формат файла не соответствует расширению' }, { status: 400 });
  }

  // кодек WAV не ограничиваем — ffmpeg в воркере декодирует и сжатый, и 32-бит float (типичный экспорт DAW)

  const buffer = Buffer.from(await file.arrayBuffer());

  const service = new TrackService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    transcodeQueue,
    { uuid: () => crypto.randomUUID(), audioStorage },
  );

  const result = await service.createUpload({
    releaseId,
    artistProfileId: artist.id,
    title,
    trackNumber: trackNum,
    ext,
    buffer,
    credits,
  });

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json({ error: result.error.message }, { status: 403 });
  }

  return NextResponse.json({ trackId: result.value.id, status: 'PROCESSING' }, { status: 201 });
}
