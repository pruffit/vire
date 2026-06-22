import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository, DrizzleTrackRepository } from '@vire/db';
import { TrackService, NotFoundError } from '@vire/core';
import { transcodeQueue } from '@/lib/queue';
import { isUuid } from '@/lib/upload';
import { getActiveArtist } from '@/lib/active-artist';

// Лёгкий поллинг статусов треков релиза: фронт опрашивает, пока есть PROCESSING,
// чтобы показать переход «обрабатывается → готов» без перезагрузки страницы.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid release id' }, { status: 400 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });

  const releaseRepo = new DrizzleReleaseRepository(db);
  const data = await releaseRepo.findWithTracks(id);
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (data.release.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    tracks: data.tracks.map((t) => ({ id: t.id, status: t.status })),
  });
}

// Перестановка порядка треков релиза (drag-n-drop): { order: string[] } —
// полный список id треков релиза в новом порядке. Перенумеровываем атомарно.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid release id' }, { status: 400 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const order = (body as { order?: unknown }).order;
  if (!Array.isArray(order) || order.some((x) => typeof x !== 'string' || !isUuid(x))) {
    return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  }

  const service = new TrackService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    transcodeQueue,
  );
  const result = await service.reorderTracks({
    releaseId: id,
    artistProfileId: artist.id,
    orderedIds: order as string[],
  });
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
