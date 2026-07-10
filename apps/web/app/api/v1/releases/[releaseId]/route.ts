import { NextResponse } from 'next/server';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { ReleaseService, NotFoundError, isReleasePubliclyVisible } from '@vire/core';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params;

  const service = new ReleaseService(new DrizzleReleaseRepository(db));
  const result = await service.getWithTracks(releaseId);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Роут публичный: черновик/архив/ещё не вышедший SCHEDULED неотличим от несуществующего.
  // Свои неопубликованные релизы артист смотрит через /api/v1/dashboard/releases/[id]/tracks.
  if (!isReleasePubliclyVisible(result.value.release, new Date())) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 });
  }

  return NextResponse.json(result.value);
}
