import { NextResponse } from 'next/server';
import { waveQuerySchema } from '@vire/api-contracts';
import {
  getWaveTracks,
  getTrackMusicalKey,
  getArtistIdsForTracks,
  getTasteProfile,
  ALL_MOODS,
  ALL_TRACK_GENRES,
  type Mood,
  type TrackGenre,
} from '@vire/db';
import { keyMatchSets } from '@vire/core';
import { auth } from '@/auth';
import { rateLimit, clientKey, tooManyRequests } from '@/lib/rate-limit';
import { getWaveSession, appendWaveServed, setWaveSessionSeed } from '@/lib/wave-session';

const EMPTY_SESSION = { servedIds: [] as string[], mood: null as string | null, genre: null as string | null };

export async function GET(req: Request) {
  // Rate limit: 120 requests per minute per IP (player calls this continuously)
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
  const queryMood = (mood ?? null) as Mood | null;
  const queryGenre = (genre ?? null) as TrackGenre | null;
  const currentTrackId = trackId ?? null;

  // sessionId нет → клиент старый/анонимный вызов вне сессии волны: работаем stateless.
  const waveSession = sessionId
    ? await getWaveSession(sessionId).catch(() => EMPTY_SESSION)
    : EMPTY_SESSION;

  // Тег настроения/жанра в seed-режиме фильтрует старт волны; в режиме похожести —
  // сессионный буст, закреплённый на первом запросе с mood/genre в этой сессии.
  let seedMood: Mood | null = null;
  let seedGenre: TrackGenre | null = null;
  let sessionMood: Mood | null = null;
  let sessionGenre: TrackGenre | null = null;
  if (!currentTrackId) {
    seedMood = queryMood ?? (waveSession.mood as Mood | null);
    seedGenre = queryGenre ?? (waveSession.genre as TrackGenre | null);
  } else {
    sessionMood = queryMood ?? (waveSession.mood as Mood | null);
    sessionGenre = queryGenre ?? (waveSession.genre as TrackGenre | null);
  }

  if (sessionId && !waveSession.mood && !waveSession.genre && (queryMood || queryGenre)) {
    await setWaveSessionSeed(sessionId, {
      mood: queryMood ?? undefined,
      genre: queryGenre ?? undefined,
    }).catch(() => {});
  }

  const playedIds = (played?.split(',').filter(Boolean) ?? []).slice(0, 100);
  const excludeIds = Array.from(
    new Set([...waveSession.servedIds, ...playedIds, currentTrackId].filter((v): v is string => Boolean(v))),
  );

  const recentServedIds = waveSession.servedIds.slice(-5);
  const recentArtistIds = recentServedIds.length > 0 ? await getArtistIdsForTracks(recentServedIds) : [];

  // Слушатель (для профиля вкуса и анти-усталости); аноним → только глобальные сигналы
  const authSession = await auth();
  const userId = authSession?.user?.id ?? null;
  const taste = userId ? await getTasteProfile(userId) : null;

  const musicalKey = currentTrackId ? await getTrackMusicalKey(currentTrackId) : null;
  const keySets = musicalKey ? keyMatchSets(musicalKey) : null;

  const tracks = await getWaveTracks({
    currentTrackId,
    excludeIds,
    limit: count,
    seedMood,
    seedGenre,
    sessionMood,
    sessionGenre,
    taste,
    keySets,
    recentArtistIds,
    userId,
  });

  if (sessionId && tracks.length > 0) {
    await appendWaveServed(sessionId, tracks.map((t) => t.id)).catch(() => {});
  }

  return NextResponse.json({
    tracks,
    // совместимость до B2: старые клиенты (wave-start-button/mood-wave-chips/audio-engine) читают data.track
    track: tracks[0] ?? null,
  });
}
