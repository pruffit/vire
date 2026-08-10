import type { WaveParams, WaveTrack, WaveSession, TasteProfile } from '../types/wave';

export interface IWaveTrackSource {
  getWaveTracks(params: WaveParams): Promise<WaveTrack[]>;
  getTrackMusicalKey(trackId: string): Promise<string | null>;
  getArtistIdsForTracks(trackIds: string[]): Promise<string[]>;
  getTasteProfile(userId: string): Promise<TasteProfile>;
}

export interface IWaveSessionStore {
  /** Недоступный Redis → пустая сессия (деградация — ответственность реализации). */
  get(sessionId: string): Promise<WaveSession>;
  appendServed(sessionId: string, trackIds: string[]): Promise<void>;
  setSeed(sessionId: string, seed: { mood?: string; genre?: string }): Promise<void>;
}
