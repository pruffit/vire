import type { PlaylistSummary, LikedTrack } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';
import { PlaylistCard } from '@/components/listener/playlist-card';
import { LikedTrackRow } from '@/components/listener/liked-track-row';
import { CreatePlaylistButton } from '@/components/listener/create-playlist-button';

interface Props {
  playlists: PlaylistSummary[];
  likedTracks: LikedTrack[];
}

export function LibraryPreviews({ playlists, likedTracks }: Props) {
  const previewLiked = likedTracks.slice(0, 5);
  const likedQueue: PlayerTrack[] = previewLiked.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    coverUrl: t.releaseCoverUrl,
    artistSlug: t.artistSlug,
    releaseId: t.releaseId,
  }));

  return (
    <div className="flex flex-col gap-10">
      <section className="animate-fade-up">
        <Section
          title="Плейлисты"
          href="/library"
          hrefLabel="Вся медиатека"
          action={<CreatePlaylistButton variant="full" />}
        >
          {playlists.length === 0 ? (
            <EmptyState title="Нет плейлистов" hint='Нажми «Создать плейлист», чтобы собрать первый' />
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
        <Section title="Любимые треки" href="/library#liked" hrefLabel="Все">
          {previewLiked.length === 0 ? (
            <EmptyState title="Ты ещё ничего не лайкал." />
          ) : (
            <div className="flex flex-col">
              {previewLiked.map((track, i) => (
                <LikedTrackRow
                  key={track.id}
                  track={{
                    id: track.id,
                    title: track.title,
                    artistName: track.artistName,
                    coverUrl: track.releaseCoverUrl,
                    artistSlug: track.artistSlug,
                    releaseId: track.releaseId,
                  }}
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
