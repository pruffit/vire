import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, DrizzleTrackRepository } from '@vire/db';
import { TrackService, NotFoundError, type TrackCredit, type ContributorRole } from '@vire/core';
import { uploadBuffer } from '@/lib/s3';
import { transcodeQueue } from '@/lib/queue';

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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(releaseId)) {
    return NextResponse.json({ error: 'Invalid releaseId' }, { status: 400 });
  }

  const trackNum = parseInt(trackNumber, 10);
  if (isNaN(trackNum) || trackNum < 1) {
    return NextResponse.json({ error: 'trackNumber must be a positive integer' }, { status: 400 });
  }

  const VALID_ROLES: ContributorRole[] = ['PERFORMER', 'LYRICIST', 'COMPOSER', 'PRODUCER'];
  const creditsRaw = formData.get('credits');
  let credits: TrackCredit[] = [];
  if (typeof creditsRaw === 'string') {
    try {
      const parsed: unknown = JSON.parse(creditsRaw);
      if (Array.isArray(parsed)) {
        credits = parsed
          .filter((c): c is TrackCredit =>
            c !== null &&
            typeof c === 'object' &&
            typeof (c as TrackCredit).name === 'string' &&
            (c as TrackCredit).name.trim().length > 0 &&
            VALID_ROLES.includes((c as TrackCredit).role),
          )
          .slice(0, 20);
      }
    } catch { /* keep empty */ }
  }

  const trackId = crypto.randomUUID();
  const sourceKey = `tracks/${trackId}/source.flac`;

  // Загружаем FLAC в vault перед созданием записи в БД
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadBuffer(sourceKey, buffer, 'audio/flac');

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
