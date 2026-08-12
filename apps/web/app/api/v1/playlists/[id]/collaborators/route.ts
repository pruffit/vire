import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { NotFoundError, ConflictError, type PlaylistCollaborator } from '@vire/core';
import {
  joinPlaylistSchema,
  type PlaylistCollaboratorsResponse,
  type PlaylistJoinResponse,
  type OkResponse,
} from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

function toResponse(collaborators: PlaylistCollaborator[]): PlaylistCollaboratorsResponse {
  return { collaborators: collaborators.map((c) => ({ ...c, joinedAt: c.joinedAt.toISOString() })) };
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().listCollaborators(id, session.user.id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json(toResponse(result.value));
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await rateLimit(`playlist-collab-join:${session.user.id}`, 20, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = joinPlaylistSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().join(id, session.user.id, parsed.data.token);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return errorJson(result.error, 404);
    if (result.error instanceof ConflictError) return errorJson(result.error, 409);
    return errorJson(result.error, 403);
  }
  return NextResponse.json({ playlist: result.value.playlist } satisfies PlaylistJoinResponse);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().leave(id, session.user.id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
