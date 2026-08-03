import { pgTable, uuid, text, timestamp, integer, pgEnum, unique, index, check, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tracks } from './releases';
import { playlists } from './interactions';

export const jamSessionStatusEnum = pgEnum('jam_session_status', ['LIVE', 'ENDED']);
export const jamParticipantRoleEnum = pgEnum('jam_participant_role', ['HOST', 'GUEST']);
export const jamModeEnum = pgEnum('jam_mode', ['SYNCED', 'SPEAKER']);
export const jamSessionKindEnum = pgEnum('jam_session_kind', ['JAM', 'PARTY']);
export const jamQueueSourceEnum = pgEnum('jam_queue_source', ['VIRE', 'YOUTUBE', 'SOUNDCLOUD', 'AUDIUS', 'LOCAL']);

export const jamSessions = pgTable('jam_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  hostUserId: uuid('host_user_id').notNull().references(() => users.id),
  title: text('title'),
  status: jamSessionStatusEnum('status').notNull().default('LIVE'),
  mode: jamModeEnum('mode').notNull().default('SYNCED'),
  kind: jamSessionKindEnum('kind').notNull().default('JAM'),
  // null = звук у хоста (дефолт); ссылка вперёд на jamParticipants — AnyPgColumn разрывает циклическую инференцию типов между таблицами.
  speakerParticipantId: uuid('speaker_participant_id').references((): AnyPgColumn => jamParticipants.id, { onDelete: 'set null' }),
  // Инкрементится в той же транзакции, что мутация очереди — переживает падение Redis
  queueVersion: integer('queue_version').notNull().default(0),
  savedPlaylistId: uuid('saved_playlist_id').references(() => playlists.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
}, (t) => [
  // авто-закрытие протухших джемов: LIVE-сессии, отсортированные по последней активности
  index('jam_sessions_status_last_activity_idx').on(t.status, t.lastActivityAt),
]);

export const jamParticipants = pgTable('jam_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  jamId: uuid('jam_id').notNull().references(() => jamSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  guestSessionId: text('guest_session_id'),
  displayName: text('display_name').notNull(),
  role: jamParticipantRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
}, (t) => [
  index('jam_participants_jam_id_idx').on(t.jamId),
  unique('jam_participants_jam_user_unique').on(t.jamId, t.userId),
  unique('jam_participants_jam_guest_unique').on(t.jamId, t.guestSessionId),
  check('jam_participants_one_identity', sql`(${t.userId} IS NOT NULL) <> (${t.guestSessionId} IS NOT NULL)`),
]);

export const jamQueueItems = pgTable('jam_queue_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  jamId: uuid('jam_id').notNull().references(() => jamSessions.id, { onDelete: 'cascade' }),
  source: jamQueueSourceEnum('source').notNull().default('VIRE'),
  trackId: uuid('track_id').references(() => tracks.id),
  externalId: text('external_id'),
  externalUrl: text('external_url'),
  // Снапшот метаданных внешней/локальной позиции — своя запись, не тянет tracks/releases join.
  title: text('title'),
  artistName: text('artist_name'),
  coverUrl: text('cover_url'),
  durationSec: integer('duration_sec'),
  position: integer('position').notNull(),
  addedByParticipantId: uuid('added_by_participant_id').references(() => jamParticipants.id, { onDelete: 'set null' }),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (t) => [
  index('jam_queue_items_jam_id_position_idx').on(t.jamId, t.position),
  // без unique(jamId, trackId): на тусовке один трек могут осознанно поставить дважды
  check(
    'jam_queue_items_source_consistency',
    sql`(
      (${t.source} = 'VIRE' AND ${t.trackId} IS NOT NULL AND ${t.externalId} IS NULL)
      OR (${t.source} IN ('YOUTUBE', 'SOUNDCLOUD') AND ${t.trackId} IS NULL AND ${t.externalId} IS NOT NULL AND ${t.title} IS NOT NULL)
      OR (${t.source} = 'LOCAL' AND ${t.trackId} IS NULL AND ${t.title} IS NOT NULL)
    )`,
  ),
]);
