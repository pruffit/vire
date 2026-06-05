import { NextResponse } from 'next/server';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { ReleaseService, NotFoundError } from '@vire/core';

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

  return NextResponse.json(result.value);
}
