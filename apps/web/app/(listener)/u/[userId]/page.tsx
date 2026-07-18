import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { loadFriendProfile } from '@/lib/friend-profile';
import { likedToPlayerTrack } from '@/lib/player/liked-to-player-track';
import { FriendButton } from '@/components/friends/friend-button';
import { ShareProfileButton } from '@/components/friends/share-profile-button';
import { MessageFriendButton } from '@/components/chat/message-friend-button';
import { PlaylistCard } from '@/components/listener/playlist-card';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';
import { FriendLikedTrackRow } from './friend-liked-track-row';

type Props = { params: Promise<{ userId: string }> };

// cache(): generateMetadata и страница читают один и тот же профиль на одном рендере
const getView = cache(async (viewerId: string | null, userId: string) => loadFriendProfile(viewerId, userId));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { userId } = await params;
  const session = await auth();
  const view = await getView(session?.user?.id ?? null, userId);
  return {
    title: view?.name ?? 'Профиль',
    // страницы людей не индексируем
    robots: { index: false, follow: false },
  };
}

export default async function FriendProfilePage({ params }: Props) {
  const { userId } = await params;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const view = await getView(viewerId, userId);
  if (!view) notFound();

  const displayName = view.name ?? 'Слушатель';
  const initials = displayName.slice(0, 2).toUpperCase();
  const queue = view.likes.map(likedToPlayerTrack);

  return (
    <main className="min-h-full w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-14">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5 animate-fade-up">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-full overflow-hidden ring-1 ring-border">
          {view.image ? (
            <Image src={view.image} alt={displayName} fill sizes="96px" className="object-cover" />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center text-xl font-semibold text-muted-foreground">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{displayName}</h1>
          <div className="flex items-center gap-2">
            {viewerId && viewerId !== view.id && (
              <FriendButton targetUserId={view.id} initialStatus={view.status} />
            )}
            {view.canChat && <MessageFriendButton targetUserId={view.id} />}
            <ShareProfileButton userId={view.id} />
          </div>
        </div>
      </div>

      {view.likesVisible ? (
        <Section title="Лайки" count={view.likes.length}>
          {view.likes.length === 0 ? (
            <EmptyState title="Пока нет лайков" />
          ) : (
            <div className="flex flex-col">
              {view.likes.map((track, i) => (
                <FriendLikedTrackRow
                  key={track.id}
                  track={queue[i]!}
                  queue={queue}
                  queueIndex={i}
                  durationSec={track.durationSec}
                  releaseCoverUrl={track.releaseCoverUrl}
                />
              ))}
            </div>
          )}
        </Section>
      ) : (
        <Section title="Лайки">
          <p className="text-sm text-muted-foreground">Лайки скрыты</p>
        </Section>
      )}

      <Section title="Публичные плейлисты" count={view.playlists.length}>
        {view.playlists.length === 0 ? (
          <EmptyState title="Нет публичных плейлистов" />
        ) : (
          <Stagger step={0.04} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {view.playlists.map((p) => (
              <StaggerItem key={p.id}>
                <PlaylistCard playlist={p} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>
    </main>
  );
}
