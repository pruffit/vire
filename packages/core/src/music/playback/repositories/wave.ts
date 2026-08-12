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

export const WAVE_SESSION_TTL_SEC = 6 * 60 * 60;
export const WAVE_SESSION_MAX_SERVED = 300;

export const waveServedKey = (sessionId: string): string => `wave:served:${sessionId}`;
export const waveSeedKey = (sessionId: string): string => `wave:seed:${sessionId}`;
