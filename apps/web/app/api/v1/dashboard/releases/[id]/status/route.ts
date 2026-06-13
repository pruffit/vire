import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository } from '@vire/db';
import type { ReleaseStatus } from '@vire/core';
import { notifyReleaseQueue } from '@/lib/queue';
import { getActiveArtist } from '@/lib/active-artist';

const ALLOWED: ReleaseStatus[] = ['PUBLISHED', 'SCHEDULED', 'ARCHIVED', 'DRAFT'];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const artist = await getActiveArtist(session.user.id, req);
  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 });
  }

  const { id } = await params;
  const releaseRepo = new DrizzleReleaseRepository(db);
  const release = await releaseRepo.findById(id);

  if (!release) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (release.artistProfileId !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { status?: string };
  if (!body.status || !ALLOWED.includes(body.status as ReleaseStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED.join(', ')}` },
      { status: 400 },
    );
  }

  const wasPublished = release.status !== 'PUBLISHED' && body.status === 'PUBLISHED';
  await releaseRepo.updateStatus(id, body.status as ReleaseStatus);

  if (wasPublished) {
    await notifyReleaseQueue.add({
      releaseId: release.id,
      releaseTitle: release.title,
      releaseType: release.type,
      coverUrl: release.coverUrl ?? null,
      artistProfileId: artist.id,
      artistName: artist.name,
      artistSlug: artist.slug,
    });
  }

  return NextResponse.json({ status: body.status });
}
