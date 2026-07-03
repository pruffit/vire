import type { PlaylistTrackRow } from '@vire/db';

export interface LazyReleaseTrack {
  id: string;
  title: string;
  trackNumber: number;
  durationSec: number | null;
  status: 'PROCESSING' | 'READY' | 'BLOCKED';
  isExplicit?: boolean;
}

/** null — сбой (сеть/не-2xx/битый JSON), кэшировать нельзя; [] — честно пустой список из 200-ответа. */
export async function fetchReleaseTracks(releaseId: string): Promise<LazyReleaseTrack[] | null> {
  const res = await fetch(`/api/v1/releases/${releaseId}`).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { tracks?: LazyReleaseTrack[] } | null;
  if (!data) return null;
  return data.tracks ?? [];
}

/** См. fetchReleaseTracks: null — сбой, [] — пустой плейлист. */
export async function fetchPlaylistTracks(playlistId: string): Promise<PlaylistTrackRow[] | null> {
  const res = await fetch(`/api/v1/playlists/${playlistId}`).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { playlist?: { tracks?: PlaylistTrackRow[] } } | null;
  if (!data) return null;
  return data.playlist?.tracks ?? [];
}
