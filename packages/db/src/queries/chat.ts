import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { conversations, messages, users } from '../schema';
import { getIdentityKeys } from './identity-keys';
import type { ChatMessage, ConversationParticipants, ConversationSummary } from '@vire/core';

type ParticipantsRow = {
  id: string; userLowId: string; userHighId: string;
  lowLastReadAt: Date | null; highLastReadAt: Date | null;
};

function toParticipants(row: ParticipantsRow): ConversationParticipants {
  return {
    id: row.id, userLowId: row.userLowId, userHighId: row.userHighId,
    lowLastReadAt: row.lowLastReadAt, highLastReadAt: row.highLastReadAt,
  };
}

const participantsSelect = {
  id: conversations.id, userLowId: conversations.userLowId, userHighId: conversations.userHighId,
  lowLastReadAt: conversations.lowLastReadAt, highLastReadAt: conversations.highLastReadAt,
};

export async function findConversation(low: string, high: string): Promise<ConversationParticipants | null> {
  const [row] = await db
    .select(participantsSelect)
    .from(conversations)
    .where(and(eq(conversations.userLowId, low), eq(conversations.userHighId, high)))
    .limit(1);
  return row ? toParticipants(row) : null;
}

export async function upsertConversation(low: string, high: string): Promise<string> {
  const [inserted] = await db
    .insert(conversations)
    .values({ userLowId: low, userHighId: high })
    .onConflictDoNothing()
    .returning({ id: conversations.id });
  if (inserted) return inserted.id;
  const existing = await findConversation(low, high);
  return existing!.id;
}

export async function getConversation(conversationId: string): Promise<ConversationParticipants | null> {
  const [row] = await db
    .select(participantsSelect)
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ? toParticipants(row) : null;
}

export async function insertMessage(conversationId: string, senderId: string, ciphertext: string, nonce: string): Promise<ChatMessage> {
  return db.transaction(async (tx) => {
    const [message] = await tx.insert(messages).values({ conversationId, senderId, body: ciphertext, nonce }).returning();

    const [conv] = await tx
      .select({ userLowId: conversations.userLowId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    const isLow = conv?.userLowId === senderId;

    // now() в SQL, не JS-Date — postgres.js не типизирует голый Date как bind-параметр в raw sql.
    await tx.update(conversations).set({
      lastMessageAt: sql`now()`,
      ...(isLow ? { lowLastReadAt: sql`now()` } : { highLastReadAt: sql`now()` }),
    }).where(eq(conversations.id, conversationId));

    return message!;
  });
}

export async function listMessages(
  conversationId: string,
  before: { createdAt: Date; id: string } | null,
  limit: number,
): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        before
          ? or(lt(messages.createdAt, before.createdAt), and(eq(messages.createdAt, before.createdAt), lt(messages.id, before.id)))
          : undefined,
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit);
  return rows.reverse();
}

export async function markConversationRead(conversationId: string, side: 'low' | 'high'): Promise<void> {
  await db.update(conversations)
    .set(side === 'low' ? { lowLastReadAt: sql`now()` } : { highLastReadAt: sql`now()` })
    .where(eq(conversations.id, conversationId));
}

type ConversationRow = {
  id: string; userLowId: string; userHighId: string;
  lastMessageAt: Date | null; lowLastReadAt: Date | null; highLastReadAt: Date | null;
};

function isUnread(row: ConversationRow, userId: string, lastMessageSenderId: string | null): boolean {
  if (!row.lastMessageAt) return false;
  if (lastMessageSenderId === userId) return false;
  const myLastRead = row.userLowId === userId ? row.lowLastReadAt : row.highLastReadAt;
  return !myLastRead || row.lastMessageAt > myLastRead;
}

async function listUserConversationRows(userId: string): Promise<ConversationRow[]> {
  return db
    .select({
      id: conversations.id, userLowId: conversations.userLowId, userHighId: conversations.userHighId,
      lastMessageAt: conversations.lastMessageAt, lowLastReadAt: conversations.lowLastReadAt, highLastReadAt: conversations.highLastReadAt,
    })
    .from(conversations)
    .where(or(eq(conversations.userLowId, userId), eq(conversations.userHighId, userId)))
    .orderBy(desc(conversations.lastMessageAt));
}

async function lastMessageByConversation(convIds: string[]): Promise<Map<string, { senderId: string; body: string; nonce: string }>> {
  if (convIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([messages.conversationId], {
      conversationId: messages.conversationId, senderId: messages.senderId, body: messages.body, nonce: messages.nonce,
    })
    .from(messages)
    .where(inArray(messages.conversationId, convIds))
    .orderBy(messages.conversationId, desc(messages.createdAt));
  return new Map(rows.map((r) => [r.conversationId, { senderId: r.senderId, body: r.body, nonce: r.nonce }]));
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const rows = await listUserConversationRows(userId);
  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.userLowId === userId ? r.userHighId : r.userLowId));
  const [otherUsers, lastByConv, ikByUser] = await Promise.all([
    db.select({ id: users.id, name: users.name, image: users.image }).from(users).where(inArray(users.id, otherIds)),
    lastMessageByConversation(rows.map((r) => r.id)),
    getIdentityKeys(otherIds),
  ]);
  const userById = new Map(otherUsers.map((u) => [u.id, u]));

  return rows.map((r) => {
    const otherId = r.userLowId === userId ? r.userHighId : r.userLowId;
    const other = userById.get(otherId);
    const last = lastByConv.get(r.id);
    return {
      id: r.id,
      otherUserId: otherId,
      otherUserName: other?.name ?? null,
      otherUserImage: other?.image ?? null,
      otherIkPub: ikByUser.get(otherId) ?? null,
      lastMessageAt: r.lastMessageAt,
      lastMessageBody: last?.body ?? null,
      lastMessageNonce: last?.nonce ?? null,
      lastMessageSenderId: last?.senderId ?? null,
      unread: isUnread(r, userId, last?.senderId ?? null),
    };
  });
}

export async function countUnreadConversations(userId: string): Promise<number> {
  const rows = await listUserConversationRows(userId);
  if (rows.length === 0) return 0;

  const lastByConv = await lastMessageByConversation(rows.map((r) => r.id));
  return rows.filter((r) => isUnread(r, userId, lastByConv.get(r.id)?.senderId ?? null)).length;
}
