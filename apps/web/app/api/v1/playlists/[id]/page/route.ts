import { NextResponse } from 'next/server';
import { db, DrizzlePlaylistPageRepository } from '@vire/db';
import { PlaylistPageService, NotFoundError, type PlaylistPageView } from '@vire/core';
import type { PlaylistPageResponse } from '@vire/api-contracts';
import { auth } from '@/auth';
import { playlistService } from '@/lib/playlist';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

function toResponse(view: PlaylistPageView): PlaylistPageResponse {
  if (view.kind === 'invite') {
    return { kind: 'invite', title: view.title, ownerUserId: view.ownerUserId };
  }
  return {
    kind: 'playlist',
    playlist: view.playlist,
    role: view.role,
    collaborators: view.collaborators.map((c) => ({ ...c, joinedAt: c.joinedAt.toISOString() })),
    liked: view.liked,
    invite: view.invite,
    inviterName: view.inviterName,
  };
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  const joinToken = new URL(req.url).searchParams.get('join') ?? undefined;

  const service = new PlaylistPageService(playlistService(), new DrizzlePlaylistPageRepository(db));
  const result = await service.getPage({ playlistId: id, viewerId: session?.user?.id ?? null, joinToken });
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json(toResponse(result.value));
}
