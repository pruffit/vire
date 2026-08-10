export interface WaveTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  feat: string[];
}

// Строки, не Mood/TrackGenre: источник правды для эти enum — @vire/db, core их не импортирует
// (см. repositories/track-moods.ts). Drizzle-реализация порта сужает до Mood/TrackGenre у себя.
export interface TasteProfile {
  topMoods: string[];
  topGenres: string[];
  topArtistIds: string[];
}

export interface WaveParams {
  currentTrackId: string | null;
  excludeIds: string[];
  limit: number;
  seedMood: string | null;
  seedGenre: string | null;
  sessionMood: string | null;
  sessionGenre: string | null;
  taste: TasteProfile | null;
  keySets: { exact: string[]; neighbor: string[] } | null;
  recentArtistIds: string[];
  userId: string | null;
}

export interface WaveSession {
  servedIds: string[];
  recentServedIds: string[];
  mood: string | null;
  genre: string | null;
}
