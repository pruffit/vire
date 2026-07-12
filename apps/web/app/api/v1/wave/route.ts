import { NextResponse } from 'next/server';
import { waveQuerySchema } from '@vire/api-contracts';
import { db, DrizzleWaveRepository, ALL_MOODS, ALL_TRACK_GENRES } from '@vire/db';
import { WaveService } from '@vire/core';
import { auth } from '@/auth';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { WaveSessionStore } from '@/lib/wave-session-store';

export async function GET(req: Request) {
  // Лимит выше обычного: плеер дёргает волну непрерывно.
  const rl = await rateLimit(clientKey(req, 'wave'), 120, 60);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const url = new URL(req.url);
  const parsed = waveQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { sessionId, trackId, mood, genre, played, count } = parsed.data;

  if (mood && !(ALL_MOODS as string[]).includes(mood)) {
    return NextResponse.json({ error: 'Invalid mood' }, { status: 400 });
  }
  if (genre && !(ALL_TRACK_GENRES as string[]).includes(genre)) {
    return NextResponse.json({ error: 'Invalid genre' }, { status: 400 });
  }

  const playedIds = (played?.split(',').filter(Boolean) ?? []).slice(0, 100);

  const authSession = await auth();
  const userId = authSession?.user?.id ?? null;

  const service = new WaveService(new DrizzleWaveRepository(db), new WaveSessionStore());
  const result = await service.next({
    sessionId: sessionId ?? null,
    userId,
    mood: mood ?? null,
    genre: genre ?? null,
    currentTrackId: trackId ?? null,
    playedIds,
    limit: count,
  });

  return NextResponse.json({ tracks: result.ok ? result.value.tracks : [] });
}
