import {
  pgTable, uuid, text, timestamp, integer, boolean, pgEnum, numeric, unique, index, check, jsonb
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tracks, releases, moodEnum } from './releases';
import { artistProfiles } from './artists';

// Различение вида общей/личной подборки идёт по kind, не по этой строке. MOOD хранит
// {mood}, PERSONAL с {mood} — личная mood-подборка, PERSONAL без params — микс «Для тебя».
export interface EditorialParams {
  mood: typeof moodEnum.enumValues[number];
}

export const purchaseItemTypeEnum = pgEnum('purchase_item_type', ['TRACK', 'RELEASE']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export const playlistVisibilityEnum = pgEnum('playlist_visibility', ['PRIVATE', 'PUBLIC']);
// Порядок append-only (миграция = ALTER TYPE ADD VALUE). PERSONAL: личные
// подборки под конкретного юзера (target_user_id), генерятся раз в 4ч.
export const playlistKindEnum = pgEnum('playlist_kind', ['USER', 'MOOD', 'TRENDING', 'RELISTEN', 'FRESH', 'PERSONAL']);
export const subscriptionTypeEnum = pgEnum('subscription_type', ['ARTIST_TIER', 'LISTENER_PREMIUM']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['ACTIVE', 'CANCELLED', 'EXPIRED']);
export const friendshipStatusEnum = pgEnum('friendship_status', ['PENDING', 'ACCEPTED']);
export const reportTargetTypeEnum = pgEnum('report_target_type', ['USER', 'MESSAGE']);
export const reportStatusEnum = pgEnum('report_status', ['OPEN', 'REVIEWED', 'DISMISSED']);

// Покупка остаётся у слушателя навсегда, даже если артист ушёл с площадки
export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  itemType: purchaseItemTypeEnum('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('RUB'),
  status: purchaseStatusEnum('status').notNull().default('PENDING'),
  paymentProvider: text('payment_provider'),
  // Идемпотентность вебхуков: повторный вебхук с тем же id не открывает доступ дважды
  externalPaymentId: text('external_payment_id').unique(),
  purchasedAt: timestamp('purchased_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // hasPurchasedTrack фильтрует по (userId, itemId, status); список покупок ищется по userId
  index('purchases_user_item_idx').on(t.userId, t.itemId),
]);

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  // null для редакционных подборок: у них нет пользователя-владельца
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  // Для личных подборок (kind=PERSONAL): кому они сгенерированы, у общих/пользовательских null.
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  kind: playlistKindEnum('kind').notNull().default('USER'),
  // Идентичность редакционной подборки для upsert/удаления стухших — не заголовок (тот
  // локализуется на рендере). null для USER и подборок без параметров (TRENDING/RELISTEN/FRESH).
  editorialParams: jsonb('editorial_params').$type<EditorialParams>(),
  visibility: playlistVisibilityEnum('visibility').notNull().default('PRIVATE'),
  isCollaborative: boolean('is_collaborative').notNull().default(false),
  // Живёт только пока is_collaborative=true: выключение обнуляет, "сбросить ссылку" ротирует.
  collabToken: text('collab_token'),
  // Версия состава (треки), инкрементится в той же транзакции, что add/remove/reorder — опорная точка realtime.
  version: integer('version').notNull().default(0),
  isCurated: boolean('is_curated').notNull().default(false),
  likesCount: integer('likes_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('playlists_owner_user_id_idx').on(t.ownerUserId),
  index('playlists_target_user_id_idx').on(t.targetUserId),
]);

// Владелец не хранится здесь (не участник своего плейлиста). Членства переживают
// выключение совместности — обратное включение возвращает ту же команду.
export const playlistCollaborators = pgTable('playlist_collaborators', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedBy: uuid('invited_by').references(() => users.id),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (t) => [
  unique('playlist_collaborators_playlist_user_unique').on(t.playlistId, t.userId),
  index('playlist_collaborators_playlist_id_idx').on(t.playlistId),
  index('playlist_collaborators_user_id_idx').on(t.userId),
]);

export const playlistTracks = pgTable('playlist_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  position: integer('position').notNull(),
  addedBy: uuid('added_by').references(() => users.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (t) => [
  index('playlist_tracks_playlist_id_idx').on(t.playlistId),
  unique('playlist_tracks_playlist_track_unique').on(t.playlistId, t.trackId),
]);

export const playlistLikes = pgTable('playlist_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('playlist_likes_user_playlist_unique').on(t.userId, t.playlistId),
  // unique ведёт по userId, счётчик по плейлисту требует отдельного индекса
  index('playlist_likes_playlist_id_idx').on(t.playlistId),
]);

export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('likes_user_track_unique').on(t.userId, t.trackId),
  // счётчик лайков по треку: unique(userId, trackId) его не покрывает
  index('likes_track_id_idx').on(t.trackId),
]);

export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  artistProfileId: uuid('artist_profile_id').notNull().references(() => artistProfiles.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('follows_user_artist_unique').on(t.userId, t.artistProfileId),
  // счётчик фолловеров по артисту: unique(userId, artistId) его не покрывает
  index('follows_artist_profile_id_idx').on(t.artistProfileId),
]);

// Залогиненный: userId (email NULL). Гость без аккаунта: email (userId NULL).
export const releasePresaves = pgTable('release_presaves', {
  id: uuid('id').primaryKey().defaultRandom(),
  releaseId: uuid('release_id').notNull().references(() => releases.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: text('email'),
  // Отметка исполнения: чтобы повторный прогон планировщика не задублировал письма/лайки
  fulfilledAt: timestamp('fulfilled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('release_presaves_release_id_idx').on(t.releaseId),
  unique('release_presaves_release_user_uq').on(t.releaseId, t.userId),
  unique('release_presaves_release_email_uq').on(t.releaseId, t.email),
]);

export const favoriteMoments = pgTable('favorite_moments', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  userId: uuid('user_id').references(() => users.id),
  positionSec: integer('position_sec').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('favorite_moments_track_id_idx').on(t.trackId)]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: subscriptionTypeEnum('type').notNull(),
  status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),
  currentPeriodEnd: timestamp('current_period_end'),
  providerSubscriptionId: text('provider_subscription_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('subscriptions_user_id_idx').on(t.userId)]);

// Двусторонняя дружба. requester — инициатор заявки. accept двигает PENDING→ACCEPTED;
// decline/cancel/unfriend удаляют строку (как unfollow). Обратный дубль ловит сервис.
export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addresseeId: uuid('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: friendshipStatusEnum('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('friendships_pair_unique').on(t.requesterId, t.addresseeId),
  index('friendships_addressee_idx').on(t.addresseeId),
  index('friendships_requester_idx').on(t.requesterId),
  check('friendships_no_self', sql`${t.requesterId} <> ${t.addresseeId}`),
]);

// Блок односторонний по инициативе, но двусторонний по эффекту (гейты читают either-way).
export const userBlocks = pgTable('user_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('user_blocks_pair_unique').on(t.blockerId, t.blockedId),
  // обратный поиск «кто меня заблокировал»
  index('user_blocks_blocked_id_idx').on(t.blockedId),
  check('user_blocks_no_self', sql`${t.blockerId} <> ${t.blockedId}`),
]);

// target_id — полиморфный uuid без FK (как purchases.item_id): цель либо users, либо messages.
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: reportTargetTypeEnum('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  reason: text('reason').notNull(),
  status: reportStatusEnum('status').notNull().default('OPEN'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  // очередь модерации: открытые жалобы, свежие сверху
  index('reports_status_created_at_idx').on(t.status, t.createdAt),
]);
