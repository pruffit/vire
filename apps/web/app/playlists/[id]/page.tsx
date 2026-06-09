import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getPlaylistWithTracks } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { PlaylistTrackRow } from './playlist-track-row';
import { PlaylistActions } from './playlist-actions';
import { formatDuration } from '@/lib/format';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return { title: 'Не найдено' };
  return { title: playlist.title };
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const playlist = await getPlaylistWithTracks(id);

  if (!playlist) notFound();

  if (playlist.visibility === 'PRIVATE' && playlist.ownerUserId !== session?.user?.id) {
    redirect('/sign-in');
  }

  const isOwner = session?.user?.id === playlist.ownerUserId;
  const totalSec = playlist.tracks.reduce((sum, t) => sum + (t.durationSec ?? 0), 0);

  const queue: PlayerTrack[] = playlist.tracks.map((t) => ({
    id: t.id,
    title: t.title,
    artistName: t.artistName,
    coverUrl: t.coverUrl,
    artistSlug: t.artistSlug,
    releaseId: t.releaseId,
  }));

  const coverUrl = playlist.tracks[0]?.coverUrl ?? null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-10">
      <FadeUp>
        <header className="flex items-start gap-6">
          {/* Обложка — первый трек или заглушка */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0 overflow-hidden bg-card border border-border">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={playlist.title}
                width={112}
                height={112}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-20">
                <PlaylistIcon />
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {playlist.title}
              </h1>
              {playlist.visibility === 'PRIVATE' && (
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  Приватный
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {playlist.tracks.length} {pluralTracks(playlist.tracks.length)}
              {totalSec > 0 && ` · ${formatDuration(totalSec)}`}
            </p>
            {isOwner && (
              <PlaylistActions playlistId={id} title={playlist.title} visibility={playlist.visibility} />
            )}
          </div>
        </header>
      </FadeUp>

      {playlist.tracks.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-muted-foreground text-sm">Плейлист пуст</p>
          <p className="text-xs text-muted-foreground opacity-60">
            Добавляй треки через кнопку «+» на странице трека
          </p>
        </div>
      ) : (
        <Stagger step={0.025} className="flex flex-col">
          {playlist.tracks.map((track, i) => (
            <StaggerItem key={track.id}>
              <PlaylistTrackRow
                track={track}
                queue={queue}
                queueIndex={i}
                playlistId={id}
                isOwner={isOwner}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </main>
  );
}

function pluralTracks(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'трек';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'трека';
  return 'треков';
}

function PlaylistIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
    </svg>
  );
}
