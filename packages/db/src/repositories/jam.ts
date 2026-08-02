import { eq, and, asc, sql, count } from 'drizzle-orm';
import { jamSessions, jamParticipants, jamQueueItems, tracks, releases, artistProfiles } from '../schema';
import type { DB } from '../client';
import { isUuid } from '@vire/core';
import { featFromCredits } from '../queries/track-credits';
import type {
  IJamRepository,
  CreateJamSessionInput,
  JamParticipantIdentity,
  UpsertJamParticipantInput,
  JamQueueItemWrite,
  JamSession,
  JamParticipant,
  JamQueueItem,
  JamSessionState,
  JamMode,
} from '@vire/core';

export class DrizzleJamRepository implements IJamRepository {
  constructor(private readonly db: DB) {}

  async createSession(input: CreateJamSessionInput): Promise<JamSession> {
    const [row] = await this.db
      .insert(jamSessions)
      .values({
        code: input.code,
        hostUserId: input.hostUserId,
        title: input.title,
        ...(input.mode ? { mode: input.mode } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
      })
      .returning();
    return mapToSession(row!);
  }

  async findByCode(code: string): Promise<JamSession | null> {
    const [row] = await this.db.select().from(jamSessions).where(eq(jamSessions.code, code)).limit(1);
    return row ? mapToSession(row) : null;
  }

  async findById(id: string): Promise<JamSession | null> {
    if (!isUuid(id)) return null;
    const [row] = await this.db.select().from(jamSessions).where(eq(jamSessions.id, id)).limit(1);
    return row ? mapToSession(row) : null;
  }

  async getSessionState(jamId: string): Promise<JamSessionState | null> {
    if (!isUuid(jamId)) return null;
    const [sessionRow] = await this.db.select().from(jamSessions).where(eq(jamSessions.id, jamId)).limit(1);
    if (!sessionRow) return null;

    const [participantRows, queue] = await Promise.all([
      this.db.select().from(jamParticipants).where(eq(jamParticipants.jamId, jamId)).orderBy(asc(jamParticipants.joinedAt)),
      this.selectQueue(jamId),
    ]);

    return {
      session: mapToSession(sessionRow),
      participants: participantRows.map(mapToParticipant),
      queue,
    };
  }

  async findParticipant(jamId: string, identity: JamParticipantIdentity): Promise<JamParticipant | null> {
    const [row] = await this.db
      .select()
      .from(jamParticipants)
      .where(and(eq(jamParticipants.jamId, jamId), identityFilter(identity)))
      .limit(1);
    return row ? mapToParticipant(row) : null;
  }

  async upsertParticipant(input: UpsertJamParticipantInput): Promise<JamParticipant> {
    const identity = input.identity;
    const userId = 'userId' in identity ? identity.userId : null;
    const guestSessionId = 'guestSessionId' in identity ? identity.guestSessionId : null;
    const [row] = await this.db
      .insert(jamParticipants)
      .values({
        jamId: input.jamId,
        userId,
        guestSessionId,
        displayName: input.displayName,
        role: input.role,
      })
      .onConflictDoUpdate({
        target: userId !== null
          ? [jamParticipants.jamId, jamParticipants.userId]
          : [jamParticipants.jamId, jamParticipants.guestSessionId],
        set: { displayName: input.displayName, lastSeenAt: sql`now()` },
      })
      .returning();
    return mapToParticipant(row!);
  }

  async touchParticipant(participantId: string): Promise<void> {
    await this.db.update(jamParticipants).set({ lastSeenAt: sql`now()` }).where(eq(jamParticipants.id, participantId));
  }

  async removeParticipant(jamId: string, participantId: string): Promise<void> {
    await this.db.delete(jamParticipants).where(and(eq(jamParticipants.jamId, jamId), eq(jamParticipants.id, participantId)));
  }

  listQueue(jamId: string): Promise<JamQueueItem[]> {
    return this.selectQueue(jamId);
  }

  async replaceQueue(jamId: string, items: JamQueueItemWrite[], nextVersion: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(jamQueueItems).where(eq(jamQueueItems.jamId, jamId));
      if (items.length > 0) {
        await tx.insert(jamQueueItems).values(
          items.map((item, position) => ({
            ...(item.id ? { id: item.id } : {}),
            jamId,
            source: item.source,
            trackId: item.trackId,
            externalId: item.externalId,
            externalUrl: item.externalUrl,
            title: item.title,
            artistName: item.artistName,
            coverUrl: item.coverUrl,
            durationSec: item.durationSec,
            position,
            addedByParticipantId: item.addedByParticipantId,
            addedAt: item.addedAt,
          })),
        );
      }
      await tx
        .update(jamSessions)
        .set({ queueVersion: nextVersion, lastActivityAt: sql`now()` })
        .where(eq(jamSessions.id, jamId));
    });
  }

  async countParticipants(jamId: string): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(jamParticipants).where(eq(jamParticipants.jamId, jamId));
    return Number(row?.n ?? 0);
  }

  async countQueueItems(jamId: string): Promise<number> {
    const [row] = await this.db.select({ n: count() }).from(jamQueueItems).where(eq(jamQueueItems.jamId, jamId));
    return Number(row?.n ?? 0);
  }

  async endSession(jamId: string): Promise<void> {
    await this.db.update(jamSessions).set({ status: 'ENDED', endedAt: sql`now()` }).where(eq(jamSessions.id, jamId));
  }

  async setSavedPlaylist(jamId: string, playlistId: string): Promise<void> {
    await this.db.update(jamSessions).set({ savedPlaylistId: playlistId }).where(eq(jamSessions.id, jamId));
  }

  async setMode(jamId: string, mode: JamMode): Promise<void> {
    await this.db.update(jamSessions).set({ mode }).where(eq(jamSessions.id, jamId));
  }

  async setSpeaker(jamId: string, participantId: string | null): Promise<void> {
    await this.db.update(jamSessions).set({ speakerParticipantId: participantId }).where(eq(jamSessions.id, jamId));
  }

  async touchActivity(jamId: string): Promise<void> {
    await this.db.update(jamSessions).set({ lastActivityAt: sql`now()` }).where(eq(jamSessions.id, jamId));
  }

  async listStaleLiveSessions(olderThanHours: number): Promise<JamSession[]> {
    const rows = await this.db
      .select()
      .from(jamSessions)
      .where(
        and(
          eq(jamSessions.status, 'LIVE'),
          sql`${jamSessions.lastActivityAt} < now() - make_interval(hours => ${olderThanHours})`,
        ),
      )
      .orderBy(asc(jamSessions.lastActivityAt));
    return rows.map(mapToSession);
  }

  private async selectQueue(jamId: string): Promise<JamQueueItem[]> {
    const rows = await this.db
      .select({
        id: jamQueueItems.id,
        source: jamQueueItems.source,
        trackId: jamQueueItems.trackId,
        externalId: jamQueueItems.externalId,
        externalUrl: jamQueueItems.externalUrl,
        position: jamQueueItems.position,
        addedByParticipantId: jamQueueItems.addedByParticipantId,
        addedAt: jamQueueItems.addedAt,
        title: sql<string>`coalesce(${tracks.title}, ${jamQueueItems.title})`,
        durationSec: sql<number | null>`coalesce(${tracks.durationSec}, ${jamQueueItems.durationSec})`,
        artistName: sql<string>`coalesce(${artistProfiles.name}, ${jamQueueItems.artistName})`,
        artistSlug: artistProfiles.slug,
        releaseId: releases.id,
        coverUrl: sql<string | null>`coalesce(${releases.coverUrl}, ${jamQueueItems.coverUrl})`,
        accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
        isExplicit: tracks.isExplicit,
        version: tracks.version,
        credits: tracks.credits,
      })
      .from(jamQueueItems)
      .leftJoin(tracks, eq(tracks.id, jamQueueItems.trackId))
      .leftJoin(releases, eq(releases.id, tracks.releaseId))
      .leftJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(eq(jamQueueItems.jamId, jamId))
      .orderBy(asc(jamQueueItems.position));

    return rows.map(({ credits, ...r }) => ({ ...r, feat: credits ? featFromCredits(credits) : null }));
  }
}

function identityFilter(identity: JamParticipantIdentity) {
  return 'userId' in identity
    ? eq(jamParticipants.userId, identity.userId)
    : eq(jamParticipants.guestSessionId, identity.guestSessionId);
}

function mapToSession(row: typeof jamSessions.$inferSelect): JamSession {
  return {
    id: row.id,
    code: row.code,
    hostUserId: row.hostUserId,
    title: row.title,
    status: row.status,
    mode: row.mode,
    kind: row.kind,
    speakerParticipantId: row.speakerParticipantId,
    queueVersion: row.queueVersion,
    savedPlaylistId: row.savedPlaylistId,
    createdAt: row.createdAt,
    lastActivityAt: row.lastActivityAt,
    endedAt: row.endedAt,
  };
}

function mapToParticipant(row: typeof jamParticipants.$inferSelect): JamParticipant {
  return {
    id: row.id,
    jamId: row.jamId,
    userId: row.userId,
    guestSessionId: row.guestSessionId,
    displayName: row.displayName,
    role: row.role,
    joinedAt: row.joinedAt,
    lastSeenAt: row.lastSeenAt,
  };
}
