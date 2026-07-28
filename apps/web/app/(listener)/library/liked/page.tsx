import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp } from '@vire/ui/motion';
import type { PlaylistWithTracks } from '@vire/db';
import { auth } from '@/auth';
import { getLikedTracksCached } from '@/lib/listener-data';
import { PlaylistView } from '../../playlists/[id]/playlist-view';
import { formatListenTime, pluralTracks } from '@/lib/format';
import { Icon } from '@/components/icon';
import { PageContainer } from '@/components/page-container';

export const metadata: Metadata = { title: 'Любимые треки' };
export const dynamic = 'force-dynamic';

export default async function LikedTracksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/library/liked');

  const liked = await getLikedTracksCached(session.user.id);
  const totalSec = liked.reduce((s, t) => s + (t.durationSec ?? 0), 0);

  const playlist: PlaylistWithTracks = {
    id: 'liked',
    title: 'Любимые треки',
    description: null,
    coverUrl: null,
    visibility: 'PUBLIC',
    ownerUserId: session.user.id,
    likesCount: 0,
    isCollaborative: false,
    version: 0,
    tracks: liked.map((t, i) => ({
      id: t.id,
      title: t.title,
      durationSec: t.durationSec,
      position: i,
      artistName: t.artistName,
      artistSlug: t.artistSlug,
      releaseId: t.releaseId,
      coverUrl: t.releaseCoverUrl,
      accentColor: t.accentColor,
      isExplicit: t.isExplicit,
      version: t.version,
      feat: t.feat,
      addedBy: null,
    })),
  };

  return (
    <PageContainer spaceY="10">
      <FadeUp>
        <header className="flex items-start gap-6">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-linear-to-br from-foreground/20 to-foreground/[0.06] sm:h-28 sm:w-28">
            <Icon name="heart" size={36} className="text-foreground" />
          </div>
          <div className="min-w-0 flex-1 max-w-2xl space-y-2 pt-1">
            <h1 className="text-2xl font-semibold tracking-tight">Любимые треки</h1>
            <p className="text-sm text-muted-foreground">
              {liked.length} {pluralTracks(liked.length)}
              {totalSec > 0 && ` · ${formatListenTime(totalSec)}`}
            </p>
          </div>
        </header>
      </FadeUp>

      <PlaylistView playlist={playlist} role="VIEWER" emptyTitle="Нет любимых треков" />
    </PageContainer>
  );
}
