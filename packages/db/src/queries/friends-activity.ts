import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { likes, follows, tracks, releases, artistProfiles, playlists, users } from '../schema';
import { listFriends } from './friendships';

export type FriendActor = { id: string; name: string | null; image: string | null };
export type FriendLikeActivity = {
  actor: FriendActor; at: Date; trackTitle: string; artistName: string; artistSlug: string; releaseId: string;
};
export type FriendFollowActivity = { actor: FriendActor; at: Date; artistName: string; artistSlug: string };
export type FriendPlaylistActivity = { actor: FriendActor; at: Date; playlistId: string; title: string };
export type FriendsActivity = {
  likes: FriendLikeActivity[];
  follows: FriendFollowActivity[];
  playlists: FriendPlaylistActivity[];
};

const EMPTY: FriendsActivity = { likes: [], follows: [], playlists: [] };

/**
 * Активность друзей (ACCEPTED). Лайки видны только если у друга social_visibility='FRIENDS';
 * подписки и публичные подборки публичны и приватностью лайков не гейтятся. Заблокированные
 * не всплывают: блокировка удаляет ребро дружбы, поэтому набор друзей их уже не содержит.
 */
export async function getFriendsActivity(userId: string, limit: number): Promise<FriendsActivity> {
  const friends = await listFriends(userId);
  if (friends.length === 0) return EMPTY;

  const friendIds = friends.map((f) => f.id);
  const actorById = new Map<string, FriendActor>(
    friends.map((f) => [f.id, { id: f.id, name: f.name, image: f.image }]),
  );

  const [likeRows, followRows, playlistRows] = await Promise.all([
    db
      .select({
        actorId: likes.userId,
        at: likes.createdAt,
        trackTitle: tracks.title,
        artistName: artistProfiles.name,
        artistSlug: artistProfiles.slug,
        releaseId: releases.id,
      })
      .from(likes)
      .innerJoin(users, eq(users.id, likes.userId))
      .innerJoin(tracks, eq(tracks.id, likes.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(and(inArray(likes.userId, friendIds), eq(users.socialVisibility, 'FRIENDS')))
      .orderBy(desc(likes.createdAt))
      .limit(limit),
    db
      .select({
        actorId: follows.userId,
        at: follows.createdAt,
        artistName: artistProfiles.name,
        artistSlug: artistProfiles.slug,
      })
      .from(follows)
      .innerJoin(artistProfiles, eq(artistProfiles.id, follows.artistProfileId))
      .where(inArray(follows.userId, friendIds))
      .orderBy(desc(follows.createdAt))
      .limit(limit),
    db
      .select({
        actorId: playlists.ownerUserId,
        at: playlists.createdAt,
        playlistId: playlists.id,
        title: playlists.title,
      })
      .from(playlists)
      .where(and(inArray(playlists.ownerUserId, friendIds), eq(playlists.visibility, 'PUBLIC'), eq(playlists.kind, 'USER')))
      .orderBy(desc(playlists.createdAt))
      .limit(limit),
  ]);

  const actor = (id: string | null): FriendActor => actorById.get(id ?? '') ?? { id: id ?? '', name: null, image: null };

  return {
    likes: likeRows.map((r) => ({
      actor: actor(r.actorId), at: r.at, trackTitle: r.trackTitle, artistName: r.artistName, artistSlug: r.artistSlug, releaseId: r.releaseId,
    })),
    follows: followRows.map((r) => ({
      actor: actor(r.actorId), at: r.at, artistName: r.artistName, artistSlug: r.artistSlug,
    })),
    playlists: playlistRows.map((r) => ({
      actor: actor(r.actorId), at: r.at, playlistId: r.playlistId, title: r.title,
    })),
  };
}
