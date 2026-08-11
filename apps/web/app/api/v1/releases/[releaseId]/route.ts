import { NextResponse } from 'next/server';
import { db, DrizzleReleaseRepository } from '@vire/db';
import { ReleaseService, NotFoundError, isReleasePubliclyVisible, type ReleaseWithTracks } from '@vire/core';
import type { ReleaseDetailResponse } from '@vire/api-contracts';
import { errorJson } from '@/lib/error-response';

function toResponse(data: ReleaseWithTracks): ReleaseDetailResponse {
  return {
    release: {
      ...data.release,
      releaseDate: data.release.releaseDate?.toISOString() ?? null,
      createdAt: data.release.createdAt.toISOString(),
      updatedAt: data.release.updatedAt.toISOString(),
    },
    tracks: data.tracks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params;

  const service = new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() });
  const result = await service.getWithTracks(releaseId);

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  // Роут публичный: черновик/архив/ещё не вышедший SCHEDULED неотличим от несуществующего.
  // Свои неопубликованные релизы артист смотрит через /api/v1/dashboard/releases/[id]/tracks.
  if (!isReleasePubliclyVisible(result.value.release, new Date())) {
    return NextResponse.json({ error: 'Release not found', code: 'release.notFound' }, { status: 404 });
  }

  return NextResponse.json(toResponse(result.value));
}
