import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { ReleaseService, NotFoundError, type ReleaseStatus } from '@vire/core';
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

  const body = await req.json().catch(() => ({})) as { status?: string };
  if (!body.status || !ALLOWED.includes(body.status as ReleaseStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED.join(', ')}` },
      { status: 400 },
    );
  }

  const service = new ReleaseService(new DrizzleReleaseRepository(db), {
    uuid: () => crypto.randomUUID(),
    notifyQueue: notifyReleaseQueue,
  });
  const result = await service.changeStatus(id, artist.id, body.status as ReleaseStatus, {
    name: artist.name,
    slug: artist.slug,
  });

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ status: result.value.status });
}
