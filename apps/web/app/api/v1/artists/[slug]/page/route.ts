import { NextResponse } from 'next/server';
import { db, DrizzleArtistReadRepository } from '@vire/db';
import { ArtistPageService, NotFoundError, type ArtistPageView } from '@vire/core';
import type { ArtistPageResponse } from '@vire/api-contracts';
import { auth } from '@/auth';
import { errorJson } from '@/lib/error-response';

function toResponse(view: ArtistPageView): ArtistPageResponse {
  return {
    artist: {
      ...view.artist,
      createdAt: view.artist.createdAt.toISOString(),
      updatedAt: view.artist.updatedAt.toISOString(),
    },
    releases: view.releases.map((r) => ({
      ...r,
      releaseDate: r.releaseDate?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    upcoming: view.upcoming.map((r) => ({
      ...r,
      releaseDate: r.releaseDate?.toISOString() ?? null,
    })),
    posts: view.posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    smartLinks: view.smartLinks.map((sl) => ({
      ...sl,
      releaseDate: sl.releaseDate?.toISOString() ?? null,
      createdAt: sl.createdAt.toISOString(),
      updatedAt: sl.updatedAt.toISOString(),
    })),
    playableTracks: view.playableTracks,
    explicitReleaseIds: [...view.explicitReleaseIds],
    following: view.following,
    followerCount: view.followerCount,
    presavedReleaseIds: [...view.presavedReleaseIds],
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const session = await auth();

  const service = new ArtistPageService(new DrizzleArtistReadRepository(db));
  const result = await service.getPage({
    slug,
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
