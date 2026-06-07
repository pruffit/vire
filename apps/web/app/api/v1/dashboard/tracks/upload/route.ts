import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, DrizzleTrackRepository } from '@vire/db';
import { TrackService, NotFoundError } from '@vire/core';
import { uploadBuffer } from '@/lib/s3';
import { transcodeQueue } from '@/lib/queue';
import { isUuid, parseAudioExt, parseCredits, parseTrackNumber } from '@/lib/upload';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // Артисты заливают мастер либо в WAV, либо в FLAC — определяем по расширению.
  const ext = parseAudioExt(file.name);
  if (!ext) {
    return NextResponse.json({ error: 'Файл должен быть WAV или FLAC' }, { status: 400 });
  }

  const trackId = crypto.randomUUID();
  const sourceKey = `tracks/${trackId}/source.${ext}`;
  const contentType = ext === 'wav' ? 'audio/wav' : 'audio/flac';

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
