import { NextResponse } from 'next/server';
import { db, DrizzleReleaseReadRepository } from '@vire/db';
import { ReleasePageService, NotFoundError, type ReleasePageView } from '@vire/core';
import type { ReleasePageResponse } from '@vire/api-contracts';
import { auth } from '@/auth';
import { errorJson } from '@/lib/error-response';

function toResponse(view: ReleasePageView): ReleasePageResponse {
  return {
    artist: {
      ...view.artist,
      createdAt: view.artist.createdAt.toISOString(),
      updatedAt: view.artist.updatedAt.toISOString(),
    },
    release: {
      ...view.release,
      releaseDate: view.release.releaseDate?.toISOString() ?? null,
      createdAt: view.release.createdAt.toISOString(),
      updatedAt: view.release.updatedAt.toISOString(),
    },
    tracks: view.tracks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    isReleased: view.isReleased,
    showCountdown: view.showCountdown,
    presaved: view.presaved,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params;
  const session = await auth();

  const service = new ReleasePageService(new DrizzleReleaseReadRepository(db), Date.now);
  const result = await service.getPage({
    releaseId,
    artistSlug: null,
    viewerId: session?.user?.id ?? null,
    viewerRole: session?.user?.role ?? null,
  });

  if (!result.ok) {
    if (result.error instanceof NotFoundError) {
      return errorJson(result.error, 404);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json(toResponse(result.value));
}
