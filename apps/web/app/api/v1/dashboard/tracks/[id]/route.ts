import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository, DrizzleTrackRepository } from '@vire/db';
import { TrackService, NotFoundError, type UpdateTrackParams } from '@vire/core';
import { transcodeQueue } from '@/lib/queue';
import { isUuid, sanitizeCredits } from '@/lib/upload';
import { getActiveArtist } from '@/lib/active-artist';
import { parseLrc } from '@/lib/lrc';

function trackService() {
  return new TrackService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    transcodeQueue,
    { uuid: () => crypto.randomUUID() },
  );
}

async function authorizeArtist(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Unauthorized', status: 401 as const };
  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) return { error: 'Artist profile not found', status: 403 as const };
  return { artistId: artist.id };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const guard = await authorizeArtist(req);
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
  if (b.version !== undefined) {
    if (b.version !== null && (typeof b.version !== 'string' || b.version.length > 80)) {
      return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
    }
    const v = typeof b.version === 'string' ? b.version.trim() : null;
    patch.version = v ? v : null;
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
  if (b.isExplicit !== undefined) {
    if (typeof b.isExplicit !== 'boolean') return NextResponse.json({ error: 'Invalid isExplicit' }, { status: 400 });
    patch.isExplicit = b.isExplicit;
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
    patch.credits = sanitizeCredits(b.credits);
  }
  if (b.lyrics !== undefined) {
    if (b.lyrics !== null && typeof b.lyrics !== 'string') {
      return NextResponse.json({ error: 'Invalid lyrics' }, { status: 400 });
    }
    if (typeof b.lyrics === 'string' && b.lyrics.length > 20000) {
      return NextResponse.json({ error: 'Lyrics too long' }, { status: 400 });
    }
    const parsed = typeof b.lyrics === 'string' ? parseLrc(b.lyrics) : null;
    patch.lyrics = parsed && parsed.length > 0 ? parsed : null;
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
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const guard = await authorizeArtist(req);
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const result = await trackService().deleteTrack({ trackId: id, artistProfileId: guard.artistId });
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return NextResponse.json({ error: result.error.message }, { status });
  }
  return NextResponse.json({ ok: true });
}
