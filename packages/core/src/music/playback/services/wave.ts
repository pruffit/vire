import { ok, type Result } from '../../../errors';
import type { IWaveTrackSource, IWaveSessionStore } from '../repositories/wave';
import type { WaveTrack, WaveSession } from '../types/wave';
import { keyMatchSets } from '../../audio/services/musical-key';

const EMPTY_SESSION: WaveSession = { servedIds: [], recentServedIds: [], mood: null, genre: null };

export interface WaveNextInput {
  sessionId: string | null;
  userId: string | null;
  mood: string | null;
  genre: string | null;
  currentTrackId: string | null;
  playedIds: string[];
  limit: number;
}

export class WaveService {
  constructor(
    private readonly source: IWaveTrackSource,
    private readonly sessions: IWaveSessionStore,
  ) {}

  async next(input: WaveNextInput): Promise<Result<{ tracks: WaveTrack[] }, Error>> {
    const { sessionId, userId, mood: queryMood, genre: queryGenre, currentTrackId, playedIds, limit } = input;

    const waveSession = sessionId ? await this.sessions.get(sessionId) : EMPTY_SESSION;

    // Тег настроения/жанра в seed-режиме фильтрует старт волны; в режиме похожести это
    // сессионный буст, закреплённый на первом запросе с mood/genre в этой сессии.
    let seedMood: string | null = null;
    let seedGenre: string | null = null;
    let sessionMood: string | null = null;
    let sessionGenre: string | null = null;
    if (!currentTrackId) {
      seedMood = queryMood ?? waveSession.mood;
      seedGenre = queryGenre ?? waveSession.genre;
    } else {
      sessionMood = queryMood ?? waveSession.mood;
      sessionGenre = queryGenre ?? waveSession.genre;
    }

    if (sessionId && !waveSession.mood && !waveSession.genre && (queryMood || queryGenre)) {
      await this.sessions.setSeed(sessionId, { mood: queryMood ?? undefined, genre: queryGenre ?? undefined });
    }

    const excludeIds = Array.from(
      new Set([...waveSession.servedIds, ...playedIds, currentTrackId].filter((v): v is string => Boolean(v))),
    );

    const recentArtistIds =
      waveSession.recentServedIds.length > 0
        ? await this.source.getArtistIdsForTracks(waveSession.recentServedIds)
        : [];

    // Слушатель (для профиля вкуса и анти-усталости); аноним → только глобальные сигналы
    const taste = userId ? await this.source.getTasteProfile(userId) : null;

    const musicalKey = currentTrackId ? await this.source.getTrackMusicalKey(currentTrackId) : null;
    const keySets = musicalKey ? keyMatchSets(musicalKey) : null;

    const tracks = await this.source.getWaveTracks({
      currentTrackId,
      excludeIds,
      limit,
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
      await this.sessions.appendServed(sessionId, tracks.map((t) => t.id));
    }

    return ok({ tracks });
  }
}
