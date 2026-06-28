import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getPlaylistWithTracks } from '@vire/db';
import { FadeUp } from '@vire/ui/motion';
import { PlaylistView } from './playlist-view';
import { PlaylistSettingsMenu } from './playlist-settings-menu';
import { formatDuration, pluralTracks } from '@/lib/format';
import { Icon } from '@/components/icon';

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
  if (playlist.visibility === 'PRIVATE' && playlist.ownerUserId !== session?.user?.id) notFound();

  const isOwner = session?.user?.id === playlist.ownerUserId;
  const totalSec = playlist.tracks.reduce((s, t) => s + (t.durationSec ?? 0), 0);
  const coverUrl = playlist.coverUrl ?? playlist.tracks[0]?.coverUrl ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12 space-y-10">
      <FadeUp>
        <header className="flex items-start gap-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0 overflow-hidden bg-card border border-border">
            {coverUrl
              ? <Image src={coverUrl} alt={playlist.title} width={112} height={112} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center opacity-20"><Icon name="list" size={32} /></div>}
          </div>
          <div className="space-y-2 pt-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight truncate">{playlist.title}</h1>
              {playlist.visibility === 'PRIVATE' && (
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-border text-muted-foreground">Приватный</span>
              )}
            </div>
            {playlist.description && <p className="text-sm text-muted-foreground/80 line-clamp-2">{playlist.description}</p>}
            <p className="text-sm text-muted-foreground">
              {playlist.tracks.length} {pluralTracks(playlist.tracks.length)}{totalSec > 0 && ` · ${formatDuration(totalSec)}`}
            </p>
            {isOwner && (
              <PlaylistSettingsMenu playlist={{ id, title: playlist.title, description: playlist.description, visibility: playlist.visibility, coverUrl: playlist.coverUrl }} />
            )}
          </div>
        </header>
      </FadeUp>

      <PlaylistView playlist={playlist} isOwner={isOwner} />
    </main>
  );
}
