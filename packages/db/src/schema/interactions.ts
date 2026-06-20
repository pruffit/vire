import {
  pgTable, uuid, text, timestamp, integer, boolean, pgEnum, numeric, unique, index
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { tracks, releases } from './releases';
import { artistProfiles } from './artists';

export const purchaseItemTypeEnum = pgEnum('purchase_item_type', ['TRACK', 'RELEASE']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export const playlistVisibilityEnum = pgEnum('playlist_visibility', ['PRIVATE', 'PUBLIC']);
// Порядок append-only (миграция = ALTER TYPE ADD VALUE). PERSONAL — личные
// подборки под конкретного юзера (target_user_id), генерятся раз в 4ч.
export const playlistKindEnum = pgEnum('playlist_kind', ['USER', 'MOOD', 'TRENDING', 'RELISTEN', 'FRESH', 'PERSONAL']);
export const subscriptionTypeEnum = pgEnum('subscription_type', ['ARTIST_TIER', 'LISTENER_PREMIUM']);
export const subscriptionStatusEnum = pgEnum('subscription_status', ['ACTIVE', 'CANCELLED', 'EXPIRED']);

// Покупки — хранятся независимо от статуса артиста
// Купленное остаётся у слушателя навсегда даже если артист ушёл
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
  // hasPurchasedTrack фильтрует по (userId, itemId, status); список покупок — по userId
  index('purchases_user_item_idx').on(t.userId, t.itemId),
]);

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  // null для редакционных подборок — у них нет пользователя-владельца
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  // Для личных подборок (kind=PERSONAL): кому они сгенерированы. У общих/пользовательских — null.
  targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  kind: playlistKindEnum('kind').notNull().default('USER'),
  visibility: playlistVisibilityEnum('visibility').notNull().default('PRIVATE'),
  isCollaborative: boolean('is_collaborative').notNull().default(false),
  isCurated: boolean('is_curated').notNull().default(false),
  likesCount: integer('likes_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('playlists_owner_user_id_idx').on(t.ownerUserId),
  index('playlists_target_user_id_idx').on(t.targetUserId),
]);

export const playlistTracks = pgTable('playlist_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  position: integer('position').notNull(),
  addedBy: uuid('added_by').references(() => users.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (t) => [index('playlist_tracks_playlist_id_idx').on(t.playlistId)]);

export const playlistLikes = pgTable('playlist_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('playlist_likes_user_playlist_unique').on(t.userId, t.playlistId),
  // unique ведёт по userId — счётчик по плейлисту требует отдельного индекса
  index('playlist_likes_playlist_id_idx').on(t.playlistId),
]);

export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('likes_user_track_unique').on(t.userId, t.trackId),
  // счётчик лайков по треку — unique(userId, trackId) его не покрывает
  index('likes_track_id_idx').on(t.trackId),
]);

export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  artistProfileId: uuid('artist_profile_id').notNull().references(() => artistProfiles.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('follows_user_artist_unique').on(t.userId, t.artistProfileId),
  // счётчик фолловеров по артисту — unique(userId, artistId) его не покрывает
  index('follows_artist_profile_id_idx').on(t.artistProfileId),
]);

// Пресейв релиза — слушатель «сохраняет заранее» ещё не вышедший (SCHEDULED)
// релиз. При выходе воркер авто-лайкает треки релиза и шлёт письмо «вышло».
// Залогиненный — userId (email NULL); гость без аккаунта — email (userId NULL).
export const releasePresaves = pgTable('release_presaves', {
  id: uuid('id').primaryKey().defaultRandom(),
  releaseId: uuid('release_id').notNull().references(() => releases.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: text('email'),
  // Отметка исполнения при выходе релиза — чтобы повторный прогон планировщика
  // не дублировал письма/лайки.
  fulfilledAt: timestamp('fulfilled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('release_presaves_release_id_idx').on(t.releaseId),
  // NULL-различимость Postgres даёт нужную семантику: один пресейв на (релиз,юзер)
  // и один на (релиз,email); строки противоположного типа (с NULL) не конфликтуют.
  unique('release_presaves_release_user_uq').on(t.releaseId, t.userId),
  unique('release_presaves_release_email_uq').on(t.releaseId, t.email),
]);

// Анонимные маркеры на волне — не комментарии, просто точка
// Агрегируется: артист видит пики вовлечённости
export const favoriteMoments = pgTable('favorite_moments', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  userId: uuid('user_id').references(() => users.id),
  positionSec: integer('position_sec').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [index('favorite_moments_track_id_idx').on(t.trackId)]);

// Полиморфная подписка — один тип для artist-tier и listener-premium
// Проверки доступа в middleware пишутся один раз
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
