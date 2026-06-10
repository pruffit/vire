import { NextResponse } from 'next/server';
import { getWaveNextTrack, ALL_MOODS, type Mood } from '@vire/db';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const trackId = url.searchParams.get('trackId') ?? null; // null = seed mode
  const played = url.searchParams.get('played')?.split(',').filter(Boolean) ?? [];

  // Тег настроения учитывается только в seed-режиме: волна стартует с трека
  // с этим тегом, дальше похожесть ведёт сама.
  const moodParam = url.searchParams.get('mood');
  const seedMood = !trackId && moodParam && (ALL_MOODS as string[]).includes(moodParam)
    ? (moodParam as Mood)
    : null;

  const next = await getWaveNextTrack(trackId, played, 1, seedMood);
  if (!next) return NextResponse.json({ track: null });

  return NextResponse.json({ track: next });
}
