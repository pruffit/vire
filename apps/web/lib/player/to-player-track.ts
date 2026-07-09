import type { PlayerTrack } from '@/store/player';

/** Общий вход для всех серверных шейпов трека (chart/playlist/release/wave/...). */
export interface PlayerTrackSource {
  id: string;
  title: string;
  artistName: string;
  coverUrl?: string | null;
  artistSlug?: string;
  releaseId?: string;
  accentColor?: string | null;
  isExplicit?: boolean | null;
  version?: string | null;
  feat?: string[];
}

/** Единая точка нормализации серверных шейпов трека в PlayerTrack для очереди плеера. */
export function toPlayerTrack(row: PlayerTrackSource): PlayerTrack {
  return {
    id: row.id,
    title: row.title,
    artistName: row.artistName,
    coverUrl: row.coverUrl ?? null,
    artistSlug: row.artistSlug,
    releaseId: row.releaseId,
    accentColor: row.accentColor ?? undefined,
    isExplicit: row.isExplicit ?? undefined,
    version: row.version ?? undefined,
    feat: row.feat,
  };
}

export function toPlayerTracks(rows: PlayerTrackSource[]): PlayerTrack[] {
  return rows.map(toPlayerTrack);
}
