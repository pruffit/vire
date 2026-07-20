import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getPlaylistWithTracks, getPlaylistLikeState } from '@vire/db';
import { FadeUp } from '@vire/ui/motion';
import { PlaylistView } from './playlist-view';
import { PlaylistSettingsMenu } from './playlist-settings-menu';
import { PlaylistLikeButton } from './playlist-like-button';
import { getHeaderCovers } from './header-cover';
import { PlaylistCover } from '@/components/playlist-cover';
import { PlaylistShare } from '@/components/playlist-share';
import { formatDuration, pluralTracks } from '@/lib/format';
import { HeartIcon } from '@/components/icons';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) return { title: 'Не найдено' };

  if (playlist.visibility === 'PRIVATE') {
    const session = await auth();
    if (session?.user?.id !== playlist.ownerUserId) return { title: 'Не найдено' };
    return { title: playlist.title, robots: { index: false, follow: false } };
  }

  const url = `/playlists/${id}`;
  const description = playlist.description
    ?? `${playlist.tracks.length} ${pluralTracks(playlist.tracks.length)} на Vire.`;

  return {
    title: playlist.title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'music.playlist', url, title: playlist.title, description },
    twitter: { card: 'summary_large_image', title: playlist.title, description },
  };
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const playlist = await getPlaylistWithTracks(id);
  if (!playlist) notFound();
  if (playlist.visibility === 'PRIVATE' && playlist.ownerUserId !== session?.user?.id) notFound();

  const isOwner = session?.user?.id === playlist.ownerUserId;
  const showLikeButton = Boolean(session?.user?.id) && !isOwner;
  const liked = session?.user?.id && !isOwner
    ? await getPlaylistLikeState(session.user.id, id)
    : false;
  const totalSec = playlist.tracks.reduce((s, t) => s + (t.durationSec ?? 0), 0);
  const headerCovers = getHeaderCovers(playlist);

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-10">
      <FadeUp>
        <header className="flex items-start gap-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0 overflow-hidden bg-card border border-border relative">
            <PlaylistCover covers={headerCovers} title={playlist.title} variant="mosaic" sizes="(max-width: 640px) 96px, 112px" />
          </div>
          <div className="space-y-2 pt-1 min-w-0 flex-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight truncate">{playlist.title}</h1>
              {playlist.visibility === 'PRIVATE' && (
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-border text-muted-foreground">Приватный</span>
              )}
            </div>
            {playlist.description && <p className="text-sm text-muted-foreground/80 line-clamp-2">{playlist.description}</p>}
            <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
              <span>
                {playlist.tracks.length} {pluralTracks(playlist.tracks.length)}{totalSec > 0 && ` · ${formatDuration(totalSec)}`}
              </span>
              {!showLikeButton && playlist.likesCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  · <HeartIcon size={13} className="opacity-70" /> {playlist.likesCount}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {showLikeButton && (
                <PlaylistLikeButton playlistId={id} initialLiked={liked} initialCount={playlist.likesCount} />
              )}
              {isOwner && (
                <PlaylistSettingsMenu playlist={{ id, title: playlist.title, description: playlist.description, visibility: playlist.visibility, coverUrl: playlist.coverUrl }} />
              )}
              <PlaylistShare playlistId={id} title={playlist.title} visibility={playlist.visibility} isOwner={isOwner} />
            </div>
          </div>
        </header>
      </FadeUp>

      <PlaylistView playlist={playlist} isOwner={isOwner} />
    </main>
  );
}
