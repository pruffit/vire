import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { NotFoundError, ConflictError } from '@vire/core';
import {
  setCollaborationSchema,
  type CollaborationInviteResponse,
  type CollaborationPatchResponse,
  type CollaborationRotateResponse,
} from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';
import { SITE_URL } from '@/lib/site';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

function inviteUrl(id: string, token: string): string {
  return `${SITE_URL}/playlists/${id}?join=${token}`;
}

export async function GET(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().getInviteToken(id, caller.id);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  const { collabToken } = result.value;
  return NextResponse.json({
    inviteUrl: collabToken ? inviteUrl(id, collabToken) : null,
  } satisfies CollaborationInviteResponse);
}

export async function PATCH(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = setCollaborationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().setCollaboration(id, caller.id, parsed.data.enabled);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  const { collabToken } = result.value;
  return NextResponse.json({
    isCollaborative: parsed.data.enabled,
    inviteUrl: collabToken ? inviteUrl(id, collabToken) : null,
  } satisfies CollaborationPatchResponse);
}

export async function POST(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().rotateCollabToken(id, caller.id);
  if (!result.ok) {
    if (result.error instanceof NotFoundError) return errorJson(result.error, 404);
    if (result.error instanceof ConflictError) return errorJson(result.error, 409);
    return errorJson(result.error, 403);
  }
  return NextResponse.json({
    inviteUrl: inviteUrl(id, result.value.collabToken),
  } satisfies CollaborationRotateResponse);
}
