import { redirect } from '@/i18n/navigation';
import type { Metadata } from 'next';
import { FadeUp } from '@vire/ui/motion';
import type { PlaylistWithTracks } from '@vire/core';
import { getLocale, getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getLikedTracksCached } from '@/lib/listener-data';
import { PlaylistView } from '../../playlists/[id]/playlist-view';
import { formatListenTime } from '@/lib/format';
import { Icon } from '@/components/icon';
import { PageContainer } from '@/components/page-container';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('library.likedTracksPage');
  return { title: t('title') };
}

export default async function LikedTracksPage() {
  const [session, locale, t, tCommon] = await Promise.all([
    auth(),
    getLocale(),
    getTranslations('library.likedTracksPage'),
    getTranslations('common'),
  ]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/library/liked', locale });

  const liked = await getLikedTracksCached(session.user.id);
  const totalSec = liked.reduce((s, t) => s + (t.durationSec ?? 0), 0);

  const playlist: PlaylistWithTracks = {
    id: 'liked',
    title: t('title'),
    description: null,
    coverUrl: null,
    kind: 'USER',
    editorialParams: null,
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
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">
              {tCommon('trackCount', { count: liked.length })}
              {totalSec > 0 && ` · ${formatListenTime(totalSec, tCommon.raw('listenTimeUnit'))}`}
            </p>
          </div>
        </header>
      </FadeUp>

      <PlaylistView playlist={playlist} role="VIEWER" emptyTitle={t('emptyTitle')} />
    </PageContainer>
  );
}
