import { getTranslations } from 'next-intl/server';
import type { PlaylistSummary, LikedTrack } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { likedToPlayerTrack } from '@/lib/player/liked-to-player-track';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';
import { PlaylistCard } from '@/components/listener/playlist-card';
import { LikedTrackRow } from '@/components/listener/liked-track-row';
import { CreatePlaylistButton } from '@/components/listener/create-playlist-button';

interface Props {
  playlists: PlaylistSummary[];
  likedTracks: LikedTrack[];
}

export async function LibraryPreviews({ playlists, likedTracks }: Props) {
  const t = await getTranslations('profile.libraryPreviews');
  const previewLiked = likedTracks.slice(0, 5);
  const likedQueue: PlayerTrack[] = previewLiked.map(likedToPlayerTrack);

  return (
    <div className="flex flex-col gap-10">
      <section className="animate-fade-up">
        <Section
          title={t('playlistsTitle')}
          href="/library"
          hrefLabel={t('wholeLibrary')}
          action={<CreatePlaylistButton variant="icon" />}
        >
          {playlists.length === 0 ? (
            <EmptyState title={t('noPlaylists')} hint={t('noPlaylistsHint')} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {playlists.slice(0, 8).map((p) => (
                <PlaylistCard key={p.id} playlist={p} />
              ))}
            </div>
          )}
        </Section>
      </section>

      <section className="animate-fade-up">
        <Section title={t('likedTracksTitle')} href="/library#liked" hrefLabel={t('allLabel')}>
          {previewLiked.length === 0 ? (
            <EmptyState title={t('noLikedTracks')} />
          ) : (
            <div className="flex flex-col">
              {previewLiked.map((track, i) => (
                <LikedTrackRow
                  key={track.id}
                  track={likedQueue[i]}
                  queue={likedQueue}
                  queueIndex={i}
                  durationSec={track.durationSec}
                  releaseCoverUrl={track.releaseCoverUrl}
                  artistSlug={track.artistSlug}
                  releaseId={track.releaseId}
                />
              ))}
            </div>
          )}
        </Section>
      </section>
    </div>
  );
}
