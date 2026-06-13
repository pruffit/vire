import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, DrizzleTrackRepository } from '@vire/db';
import { TrackService, NotFoundError, type UpdateTrackParams } from '@vire/core';
import { transcodeQueue } from '@/lib/queue';
import { isUuid, sanitizeCredits } from '@/lib/upload';

function trackService() {
  return new TrackService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    transcodeQueue,
  );
}

async function authorizeArtist() {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized', status: 401 as const };
  const artist = await new DrizzleArtistRepository(db).findByUserId(session.user.id);
  if (!artist) return { error: 'Artist profile not found', status: 403 as const };
  return { artistId: artist.id };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const guard = await authorizeArtist();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const patch: UpdateTrackParams = {};
  if (b.title !== undefined) {
    if (typeof b.title !== 'string' || b.title.trim().length === 0 || b.title.length > 200) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }
    patch.title = b.title.trim();
  }
  if (b.trackNumber !== undefined) {
    if (typeof b.trackNumber !== 'number' || !Number.isInteger(b.trackNumber) || b.trackNumber < 1) {
      return NextResponse.json({ error: 'Invalid trackNumber' }, { status: 400 });
    }
    patch.trackNumber = b.trackNumber;
  }
  if (b.isExclusive !== undefined) {
    if (typeof b.isExclusive !== 'boolean') return NextResponse.json({ error: 'Invalid isExclusive' }, { status: 400 });
    patch.isExclusive = b.isExclusive;
  }
  if (b.isWip !== undefined) {
    if (typeof b.isWip !== 'boolean') return NextResponse.json({ error: 'Invalid isWip' }, { status: 400 });
    patch.isWip = b.isWip;
  }
  if (b.bpm !== undefined) {
    if (b.bpm !== null && (typeof b.bpm !== 'number' || !Number.isInteger(b.bpm) || b.bpm < 20 || b.bpm > 500)) {
      return NextResponse.json({ error: 'Invalid bpm' }, { status: 400 });
    }
    patch.bpm = b.bpm as number | null;
  }
  if (b.musicalKey !== undefined) {
    if (b.musicalKey !== null && (typeof b.musicalKey !== 'string' || b.musicalKey.length > 20)) {
      return NextResponse.json({ error: 'Invalid musicalKey' }, { status: 400 });
    }
    patch.musicalKey = b.musicalKey as string | null;
  }
  if (b.credits !== undefined) {
    if (!Array.isArray(b.credits)) {
      return NextResponse.json({ error: 'Invalid credits' }, { status: 400 });
    }
    // Чистим вход: отбрасываем мусор, тримим имена, режем до лимита.
    patch.credits = sanitizeCredits(b.credits);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const result = await trackService().updateTrack({ trackId: id, artistProfileId: guard.artistId, patch });
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ track: result.value });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const guard = await authorizeArtist();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const result = await trackService().deleteTrack({ trackId: id, artistProfileId: guard.artistId });
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
