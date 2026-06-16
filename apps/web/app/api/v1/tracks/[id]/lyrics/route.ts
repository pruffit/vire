import { NextResponse } from 'next/server';
import { getPublicTrackLyrics } from '@vire/db';
import { isUuid } from '@/lib/upload';

/** Текст трека для плеера. Отдаётся только для опубликованных релизов. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });

  const lyrics = await getPublicTrackLyrics(id);
  return NextResponse.json(
    { lyrics },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
  );
}
