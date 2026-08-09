import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getPlaylistWithTracks, getPlaylistLikeState, getUserProfile } from '@vire/db';
import type { PlaylistCollaborator } from '@vire/core';
import { FadeUp } from '@vire/ui/motion';
import { PlaylistView, type PlaylistViewerRole } from './playlist-view';
import { PlaylistSettingsMenu } from './playlist-settings-menu';
import { PlaylistLikeButton } from './playlist-like-button';
import { PlaylistLeaveButton } from './playlist-leave-button';
import { PlaylistJoinBanner } from './playlist-join-banner';
import { PlaylistInviteScreen } from './playlist-invite-screen';
import { PlaylistCollabBadge, PlaylistCollaboratorsStack } from './playlist-collaborators';
import { getHeaderCovers } from './header-cover';
import { playlistService } from '@/lib/playlist';
import { PlaylistCover } from '@/components/playlist-cover';
import { PlaylistShare } from '@/components/playlist-share';
import { PageContainer } from '@/components/page-container';
import { JsonLd } from '@/components/json-ld';
import { musicPlaylistJsonLd } from '@/lib/structured-data';
import { formatDuration } from '@/lib/format';
import { HeartIcon } from '@/components/icons';
import { pageMetadata } from '@/lib/metadata';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ join?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);
  const t = await getTranslations('playlist');
  if (!playlist) return { title: t('notFound') };

  if (playlist.visibility === 'PRIVATE') {
    const { join: joinToken } = await searchParams;
    const session = await auth();
    const allowed = await playlistService().getForViewer(id, session?.user?.id ?? null, joinToken);
    if (!allowed.ok) return { title: t('notFound') };
    return { title: playlist.title, robots: { index: false, follow: false } };
  }

  const url = `/playlists/${id}`;
  const description = playlist.description
    ?? t('metaDescriptionFallback', { count: playlist.tracks.length });

  return pageMetadata({
    url,
    title: playlist.title,
    description,
    type: 'music.playlist',
    // своя динамическая og-картинка — mosaic обложек, app/(listener)/playlists/[id]/opengraph-image.tsx
    images: null,
  });
}

export default async function PlaylistPage({ params, searchParams }: Props) {
  const t = await getTranslations();
  const { id } = await params;
  const { join: joinToken } = await searchParams;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const service = playlistService();
  const inviteResult = joinToken ? await service.checkInvite(id, joinToken) : null;
  const invite = inviteResult?.ok ? inviteResult.value : null;

  const result = await service.getForViewer(id, viewerId, joinToken);
  if (!result.ok) {
    // Анониму по валидной ссылке показываем приглашение, а не 404 — но без состава плейлиста.
    if (invite && joinToken && !viewerId) {
      return <PlaylistInviteScreen playlistId={id} token={joinToken} title={invite.title} ownerUserId={invite.ownerUserId} />;
    }
    notFound();
  }
  const playlist = result.value;

  const isOwner = viewerId !== null && playlist.ownerUserId === viewerId;
  let role: PlaylistViewerRole = isOwner ? 'OWNER' : 'VIEWER';
  let collaborators: PlaylistCollaborator[] = [];

  if (isOwner && viewerId) {
    const collabResult = await service.listCollaborators(id, viewerId);
    if (collabResult.ok) collaborators = collabResult.value;
  } else if (viewerId && playlist.isCollaborative) {
    const collabResult = await service.listCollaborators(id, viewerId);
    if (collabResult.ok) {
      collaborators = collabResult.value;
      role = 'COLLABORATOR';
    }
  }

  const showJoinBanner = playlist.isCollaborative && invite !== null && role === 'VIEWER';
  let inviterName = t('playlist.defaultOwnerName');
  if (showJoinBanner && playlist.ownerUserId) {
    const owner = await getUserProfile(playlist.ownerUserId);
    if (owner?.name) inviterName = owner.name;
  }

  const showLikeButton = Boolean(viewerId) && !isOwner;
  const liked = viewerId && !isOwner
    ? await getPlaylistLikeState(viewerId, id)
    : false;
  const totalSec = playlist.tracks.reduce((s, t) => s + (t.durationSec ?? 0), 0);
  const headerCovers = getHeaderCovers(playlist);

  return (
    <PageContainer spaceY="10">
      {playlist.visibility === 'PUBLIC' && (
        <JsonLd
          data={musicPlaylistJsonLd({
            id,
            title: playlist.title,
            description: playlist.description,
            tracks: playlist.tracks,
          })}
        />
      )}
      <FadeUp>
        <header className="flex items-start gap-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl shrink-0 overflow-hidden bg-card border border-border relative">
            <PlaylistCover covers={headerCovers} title={playlist.title} variant="mosaic" sizes="(max-width: 640px) 96px, 112px" />
          </div>
          <div className="space-y-2 pt-1 min-w-0 flex-1 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight truncate">{playlist.title}</h1>
              {playlist.visibility === 'PRIVATE' && (
                <span className="shrink-0 label-mono text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">{t('playlist.visibility.private')}</span>
              )}
              {playlist.isCollaborative && <PlaylistCollabBadge />}
              {playlist.isCollaborative && collaborators.length > 0 && (
                <PlaylistCollaboratorsStack collaborators={collaborators} />
              )}
            </div>
            {playlist.description && <p className="text-sm text-muted-foreground/80 line-clamp-2">{playlist.description}</p>}
            <p className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap tabular-nums">
              <span>
                {t('common.trackCount', { count: playlist.tracks.length })}{totalSec > 0 && ` · ${formatDuration(totalSec)}`}
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
                <PlaylistSettingsMenu
                  playlist={{ id, title: playlist.title, description: playlist.description, visibility: playlist.visibility, coverUrl: playlist.coverUrl, isCollaborative: playlist.isCollaborative }}
                  collaborators={collaborators}
                />
              )}
              {role === 'COLLABORATOR' && <PlaylistLeaveButton playlistId={id} />}
              <PlaylistShare playlistId={id} title={playlist.title} visibility={playlist.visibility} isOwner={isOwner} />
            </div>
          </div>
        </header>
      </FadeUp>

      {showJoinBanner && joinToken && (
        <PlaylistJoinBanner playlistId={id} token={joinToken} inviterName={inviterName} isAuthenticated={viewerId !== null} />
      )}

      <PlaylistView playlist={playlist} role={role} viewerId={viewerId} />
    </PageContainer>
  );
}
