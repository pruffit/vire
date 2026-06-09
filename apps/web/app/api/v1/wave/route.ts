import { NextResponse } from 'next/server';
import { getWaveNextTrack } from '@vire/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const trackId = url.searchParams.get('trackId');
  const played = url.searchParams.get('played')?.split(',').filter(Boolean) ?? [];

  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 });

  const next = await getWaveNextTrack(trackId, played);
  if (!next) return NextResponse.json({ track: null });

  return NextResponse.json({ track: next });
}
