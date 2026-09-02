import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { isUuid } from '@vire/core';
import { db } from '../client';
import { playlists, playlistCollaborators, playlistTracks, users } from '../schema';

// Соавторство плейлистов: приглашение по токену, состав участников, выход и
// принудительное снятие членства при блокировке пользователей.

export interface PlaylistCollaboratorRow {
  userId: string;
  name: string | null;
  image: string | null;
  joinedAt: Date;
}

export interface PlaylistCollabState {
  isCollaborative: boolean;
  collabToken: string | null;
  version: number;
  ownerUserId: string | null;
}

export interface PlaylistInvitePreviewRow {
  title: string;
  ownerUserId: string | null;
  isCollaborative: boolean;
  collabToken: string | null;
}

export type JoinCollaboratorOutcome = 'joined' | 'already' | 'full';


export async function listPlaylistCollaborators(playlistId: string): Promise<PlaylistCollaboratorRow[]> {
  return db
    .select({ userId: playlistCollaborators.userId, name: users.name, image: users.image, joinedAt: playlistCollaborators.joinedAt })
    .from(playlistCollaborators)
    .innerJoin(users, eq(users.id, playlistCollaborators.userId))
    .where(eq(playlistCollaborators.playlistId, playlistId))
    .orderBy(asc(playlistCollaborators.joinedAt));
}

export async function isPlaylistCollaborator(playlistId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: playlistCollaborators.id })
    .from(playlistCollaborators)
    .where(and(eq(playlistCollaborators.playlistId, playlistId), eq(playlistCollaborators.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** true, если строка реально удалена (не no-op) — гейт для рассылки playlist:collaborators. */
export async function removePlaylistCollaborator(playlistId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(playlistCollaborators)
    .where(and(eq(playlistCollaborators.playlistId, playlistId), eq(playlistCollaborators.userId, userId)))
    .returning({ id: playlistCollaborators.id });
  return result.length > 0;
}

/** Атомарно (лочит строку плейлиста): вставляет коллаборатора, если ещё не участник и лимит не исчерпан. */
export async function joinPlaylistCollaborator(
  playlistId: string,
  userId: string,
  invitedBy: string,
  maxCollaborators: number,
): Promise<JoinCollaboratorOutcome> {
  return db.transaction(async (tx) => {
    await tx.select({ id: playlists.id }).from(playlists).where(eq(playlists.id, playlistId)).for('update');

    const [existing] = await tx
      .select({ id: playlistCollaborators.id })
      .from(playlistCollaborators)
      .where(and(eq(playlistCollaborators.playlistId, playlistId), eq(playlistCollaborators.userId, userId)))
      .limit(1);
    if (existing) return 'already';

    const [{ n }] = await tx
      .select({ n: count() })
      .from(playlistCollaborators)
      .where(eq(playlistCollaborators.playlistId, playlistId));
    if (Number(n) >= maxCollaborators) return 'full';

    await tx.insert(playlistCollaborators).values({ playlistId, userId, invitedBy }).onConflictDoNothing();
    return 'joined';
  });
}

export async function setPlaylistCollaboration(
  playlistId: string,
  ownerId: string,
  input: { isCollaborative: boolean; collabToken: string | null },
): Promise<void> {
  await db
    .update(playlists)
    .set({ isCollaborative: input.isCollaborative, collabToken: input.collabToken, updatedAt: new Date() })
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, ownerId)));
}

export async function getPlaylistCollabState(playlistId: string): Promise<PlaylistCollabState | null> {
  if (!isUuid(playlistId)) return null;
  const [row] = await db
    .select({
      isCollaborative: playlists.isCollaborative,
      collabToken: playlists.collabToken,
      version: playlists.version,
      ownerUserId: playlists.ownerUserId,
    })
    .from(playlists)
    .where(eq(playlists.id, playlistId));
  return row ?? null;
}

export async function getPlaylistTrackAddedBy(playlistId: string, trackId: string): Promise<string | null> {
  const [row] = await db
    .select({ addedBy: playlistTracks.addedBy })
    .from(playlistTracks)
    .where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId)))
    .limit(1);
  return row?.addedBy ?? null;
}

/** Минимум данных для экрана приглашения (без состава треков) — доступно и анониму по токену. */
export async function getPlaylistInvitePreview(playlistId: string): Promise<PlaylistInvitePreviewRow | null> {
  if (!isUuid(playlistId)) return null;
  const [row] = await db
    .select({
      title: playlists.title,
      ownerUserId: playlists.ownerUserId,
      isCollaborative: playlists.isCollaborative,
      collabToken: playlists.collabToken,
    })
    .from(playlists)
    .where(eq(playlists.id, playlistId));
  return row ?? null;
}

/** Снимает совместное членство между userA и userB в обе стороны (блокировка). Возвращает id затронутых плейлистов. */
export async function removeCollaboratorMembershipBetween(userA: string, userB: string): Promise<string[]> {
  const ownedByA = await db.select({ id: playlists.id }).from(playlists).where(eq(playlists.ownerUserId, userA));
  const ownedByB = await db.select({ id: playlists.id }).from(playlists).where(eq(playlists.ownerUserId, userB));

  const removed: string[] = [];

  if (ownedByA.length > 0) {
    const rows = await db
      .delete(playlistCollaborators)
      .where(and(inArray(playlistCollaborators.playlistId, ownedByA.map((r) => r.id)), eq(playlistCollaborators.userId, userB)))
      .returning({ playlistId: playlistCollaborators.playlistId });
    removed.push(...rows.map((r) => r.playlistId));
  }

  if (ownedByB.length > 0) {
    const rows = await db
      .delete(playlistCollaborators)
      .where(and(inArray(playlistCollaborators.playlistId, ownedByB.map((r) => r.id)), eq(playlistCollaborators.userId, userA)))
      .returning({ playlistId: playlistCollaborators.playlistId });
    removed.push(...rows.map((r) => r.playlistId));
  }

  return removed;
}
