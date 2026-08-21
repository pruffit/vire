'use client';

import type { SearchTrack } from '@vire/db';
import { PlayableTrackList } from './track-list';

export function SearchTracksSection({ tracks }: { tracks: SearchTrack[] }) {
  return (
    <PlayableTrackList
      variant="plain"
      columns={2}
      tracks={tracks.map((t) => ({
        id: t.id, title: t.title, artistName: t.artistName,
        artistSlug: t.artistSlug, releaseId: t.releaseId, coverUrl: t.coverUrl,
        version: t.version, feat: t.feat,
      }))}
      context={{ source: 'search' }}
      quickAdd
    />
  );
}
