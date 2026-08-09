import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { NotFoundError, ConflictError } from '@vire/core';
import { playlistService } from '@/lib/playlist';
import { SITE_URL } from '@/lib/site';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({ enabled: z.boolean() });

function inviteUrl(id: string, token: string): string {
  return `${SITE_URL}/playlists/${id}?join=${token}`;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().getInviteToken(id, session.user.id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  const { collabToken } = result.value;
  return NextResponse.json({ inviteUrl: collabToken ? inviteUrl(id, collabToken) : null });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().setCollaboration(id, session.user.id, parsed.data.enabled);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  const { collabToken } = result.value;
  return NextResponse.json({
    isCollaborative: parsed.data.enabled,
    inviteUrl: collabToken ? inviteUrl(id, collabToken) : null,
  });
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().rotateCollabToken(id, session.user.id);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return errorJson(result.error, 404);
    if (result.error instanceof ConflictError) return errorJson(result.error, 409);
    return errorJson(result.error, 403);
  }
  return NextResponse.json({ inviteUrl: inviteUrl(id, result.value.collabToken) });
}
