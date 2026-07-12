import type { DB } from '../client';
import type { IWaveTrackSource, WaveParams, WaveTrack, TasteProfile } from '@vire/core';
import {
  getWaveTracks as getWaveTracksQuery,
  getTrackMusicalKey as getTrackMusicalKeyQuery,
  getArtistIdsForTracks as getArtistIdsForTracksQuery,
} from '../queries/wave';
import { getTasteProfile as getTasteProfileQuery } from '../queries/taste';
import type { Mood } from '../queries/track-moods';
import type { TrackGenre } from '../queries/track-genres';

export class DrizzleWaveRepository implements IWaveTrackSource {
  constructor(private readonly db: DB) {}

  getWaveTracks(params: WaveParams): Promise<WaveTrack[]> {
    return getWaveTracksQuery({
      currentTrackId: params.currentTrackId,
      excludeIds: params.excludeIds,
      limit: params.limit,
      seedMood: params.seedMood as Mood | null,
      seedGenre: params.seedGenre as TrackGenre | null,
      sessionMood: params.sessionMood as Mood | null,
      sessionGenre: params.sessionGenre as TrackGenre | null,
      taste: params.taste
        ? {
            topMoods: params.taste.topMoods as Mood[],
            topGenres: params.taste.topGenres as TrackGenre[],
            topArtistIds: params.taste.topArtistIds,
          }
        : null,
      keySets: params.keySets,
      recentArtistIds: params.recentArtistIds,
      userId: params.userId,
    });
  }

  getTrackMusicalKey(trackId: string): Promise<string | null> {
    return getTrackMusicalKeyQuery(trackId);
  }

  getArtistIdsForTracks(trackIds: string[]): Promise<string[]> {
    return getArtistIdsForTracksQuery(trackIds);
  }

  getTasteProfile(userId: string): Promise<TasteProfile> {
    return getTasteProfileQuery(userId);
  }
}
