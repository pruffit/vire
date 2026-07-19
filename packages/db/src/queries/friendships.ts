import { and, eq, or, count, desc, inArray, sql } from 'drizzle-orm';
import { db } from '../client';
import { friendships, users } from '../schema';
import type { FriendEdge, FriendProfile, IncomingRequest } from '@vire/core';

export async function findEdge(a: string, b: string): Promise<FriendEdge | null> {
  const [row] = await db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId, status: friendships.status })
    .from(friendships)
    .where(or(
      and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
      and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
    ))
    .limit(1);
  return row ?? null;
}

export async function insertRequest(from: string, to: string): Promise<void> {
  await db.insert(friendships).values({ requesterId: from, addresseeId: to }).onConflictDoNothing();
}

export async function acceptRequest(requesterId: string, addresseeId: string): Promise<void> {
  await db.update(friendships).set({ status: 'ACCEPTED', updatedAt: new Date() })
    .where(and(
      eq(friendships.requesterId, requesterId),
      eq(friendships.addresseeId, addresseeId),
      eq(friendships.status, 'PENDING'),
    ));
}

export async function deleteEdge(a: string, b: string): Promise<void> {
  await db.delete(friendships).where(or(
    and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
    and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
  ));
}

export async function listFriends(userId: string): Promise<FriendProfile[]> {
  const rows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      since: friendships.updatedAt,
      reqName: users.name, reqImage: users.image,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.status, 'ACCEPTED'), eq(friendships.addresseeId, userId)))
    .orderBy(desc(friendships.updatedAt));
  const incoming = rows.map((r): FriendProfile => ({ id: r.requesterId, name: r.reqName, image: r.reqImage, since: r.since }));

  const rows2 = await db
    .select({
      addresseeId: friendships.addresseeId,
      since: friendships.updatedAt,
      addrName: users.name, addrImage: users.image,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.addresseeId))
    .where(and(eq(friendships.status, 'ACCEPTED'), eq(friendships.requesterId, userId)))
    .orderBy(desc(friendships.updatedAt));
  const outgoing = rows2.map((r): FriendProfile => ({ id: r.addresseeId, name: r.addrName, image: r.addrImage, since: r.since }));

  return [...incoming, ...outgoing].sort((x, y) => y.since.getTime() - x.since.getTime());
}

export async function listIncoming(userId: string): Promise<IncomingRequest[]> {
  const rows = await db
    .select({ id: friendships.requesterId, name: users.name, image: users.image, requestedAt: friendships.createdAt })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.requesterId))
    .where(and(eq(friendships.status, 'PENDING'), eq(friendships.addresseeId, userId)))
    .orderBy(desc(friendships.createdAt));
  return rows;
}

export async function userExists(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  return !!row;
}

export async function listEdges(userId: string, otherIds: string[]): Promise<FriendEdge[]> {
  if (otherIds.length === 0) return [];
  return db
    .select({ requesterId: friendships.requesterId, addresseeId: friendships.addresseeId, status: friendships.status })
    .from(friendships)
    .where(or(
      and(eq(friendships.requesterId, userId), inArray(friendships.addresseeId, otherIds)),
      and(eq(friendships.addresseeId, userId), inArray(friendships.requesterId, otherIds)),
    ));
}

export async function countUnseenIncoming(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(friendships)
    .innerJoin(users, eq(users.id, userId))
    .where(and(
      eq(friendships.status, 'PENDING'),
      eq(friendships.addresseeId, userId),
      sql`(${users.friendRequestsSeenAt} is null or ${friendships.createdAt} > ${users.friendRequestsSeenAt})`,
    ));
  return row?.count ?? 0;
}

export async function markRequestsSeen(userId: string): Promise<void> {
  await db.update(users).set({ friendRequestsSeenAt: sql`now()` }).where(eq(users.id, userId));
}
