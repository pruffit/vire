import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import type { PlaylistSummary } from '@vire/core';
import { createPlaylistSchema, type PlaylistListResponse, type CreatePlaylistResponse } from '@vire/api-contracts';
import { playlistService } from '@/lib/playlist';

function toSummary(p: PlaylistSummary): PlaylistListResponse['playlists'][number] {
  return { ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}

export async function GET(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const trackIdParam = new URL(req.url).searchParams.get('trackId');

  // ?trackId=<uuid>: какие из плейлистов уже содержат этот трек (для галочек)
  let trackId: string | undefined;
  if (trackIdParam !== null) {
    const parsed = z.string().uuid().safeParse(trackIdParam);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid trackId' }, { status: 400 });
    trackId = parsed.data;
  }

  const result = await playlistService().listForUser(caller.id, trackId);
  if (!result.ok) return NextResponse.json({ playlists: [] } satisfies PlaylistListResponse);

  const { playlists, inPlaylists } = result.value;
  return NextResponse.json({
    playlists: playlists.map(toSummary),
    ...(inPlaylists !== undefined ? { inPlaylists } : {}),
  } satisfies PlaylistListResponse);
}

export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createPlaylistSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });

  const result = await playlistService().create(caller.id, parsed.data.title);
  if (!result.ok) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  return NextResponse.json({ id: result.value.id } satisfies CreatePlaylistResponse, { status: 201 });
}
