import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { NotFoundError, type PlaylistUpdatePatch } from '@vire/core';
import { updatePlaylistSchema, type PlaylistDetailResponse, type OkResponse } from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const caller = await getCaller();

  const result = await playlistService().getForViewer(id, caller?.id ?? null);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ playlist: result.value } satisfies PlaylistDetailResponse);
}

export async function PATCH(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updatePlaylistSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const patch: PlaylistUpdatePatch = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility;

  const result = await playlistService().update(id, caller.id, patch);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

export async function DELETE(_req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const result = await playlistService().delete(id, caller.id);
  if (!result.ok) return errorJson(result.error, 404);
  return NextResponse.json({ ok: true } satisfies OkResponse);
}
