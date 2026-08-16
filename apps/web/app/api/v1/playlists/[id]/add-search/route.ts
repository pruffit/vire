import { NextResponse } from 'next/server';
import { getCaller } from '@/lib/caller';
import { NotFoundError } from '@vire/core';
import { playlistSearchQuerySchema, type PlaylistSearchResponse } from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';
import { errorJson } from '@/lib/error-response';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { q } = playlistSearchQuerySchema.parse({ q: new URL(req.url).searchParams.get('q') ?? '' });
  const result = await playlistService().searchForAdding(id, caller.id, q);
  if (!result.ok) {
    const status = result.error instanceof NotFoundError ? 404 : 403;
    return errorJson(result.error, status);
  }
  return NextResponse.json({ tracks: result.value } satisfies PlaylistSearchResponse);
}
