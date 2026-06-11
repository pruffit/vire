import { NextResponse } from 'next/server';
import { getWaveNextTrack, ALL_MOODS, type Mood } from '@vire/db';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';

export async function GET(req: Request) {
  // Rate limit: 120 requests per minute per IP (player calls this continuously)
  const rl = await rateLimit(clientKey(req, 'wave'), 120, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

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
