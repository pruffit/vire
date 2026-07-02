import type { LikedTrack, FollowedArtist, PlaylistSummary } from '@vire/db';

export type ActivityItem =
  | { kind: 'like'; at: Date; trackTitle: string; artistName: string; artistSlug: string; releaseId: string }
  | { kind: 'follow'; at: Date; artistName: string; artistSlug: string }
  | { kind: 'playlist'; at: Date; playlistId: string; title: string };

export function mergeActivity(
  likes: LikedTrack[],
  follows: FollowedArtist[],
  playlists: PlaylistSummary[],
  limit = 12,
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...likes.map(
      (l): ActivityItem => ({
        kind: 'like',
        at: l.likedAt,
        trackTitle: l.title,
        artistName: l.artistName,
        artistSlug: l.artistSlug,
        releaseId: l.releaseId,
      }),
    ),
    ...follows.map(
      (f): ActivityItem => ({ kind: 'follow', at: f.followedAt, artistName: f.name, artistSlug: f.slug }),
    ),
    ...playlists.map(
      (p): ActivityItem => ({ kind: 'playlist', at: p.createdAt, playlistId: p.id, title: p.title }),
    ),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Стабильный ключ для рендера — переживает добавление новых событий в начало списка. */
export function activityKey(item: ActivityItem): string {
  const id =
    item.kind === 'like' ? `${item.releaseId}:${item.trackTitle}`
    : item.kind === 'follow' ? item.artistSlug
    : item.playlistId;
  return `${item.kind}:${id}:${item.at.getTime()}`;
}
