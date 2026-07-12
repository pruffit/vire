import { NextResponse } from 'next/server';
import { db, DrizzleListenerTrackRepository } from '@vire/db';
import { ListenerTrackService, isUuid } from '@vire/core';

/** Текст трека для плеера. Отдаётся только для опубликованных релизов. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const result = await new ListenerTrackService(new DrizzleListenerTrackRepository(db)).getPublicLyrics(id);
  return NextResponse.json(
    { lyrics: result.ok ? result.value : null },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
