import {
  pgTable, uuid, text, timestamp, integer, boolean, pgEnum, numeric, unique
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { tracks, releases } from './releases';
import { artistProfiles } from './artists';

export const purchaseItemTypeEnum = pgEnum('purchase_item_type', ['TRACK', 'RELEASE']);
export const purchaseStatusEnum = pgEnum('purchase_status', ['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export const playlistVisibilityEnum = pgEnum('playlist_visibility', ['PRIVATE', 'PUBLIC']);
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
});

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  visibility: playlistVisibilityEnum('visibility').notNull().default('PRIVATE'),
  isCollaborative: boolean('is_collaborative').notNull().default(false),
  isCurated: boolean('is_curated').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const playlistTracks = pgTable('playlist_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  position: integer('position').notNull(),
  addedBy: uuid('added_by').references(() => users.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  artistProfileId: uuid('artist_profile_id').notNull().references(() => artistProfiles.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [unique('follows_user_artist_unique').on(t.userId, t.artistProfileId)]);

// Анонимные маркеры на волне — не комментарии, просто точка
// Агрегируется: артист видит пики вовлечённости
export const favoriteMoments = pgTable('favorite_moments', {
  id: uuid('id').primaryKey().defaultRandom(),
  trackId: uuid('track_id').notNull().references(() => tracks.id),
  userId: uuid('user_id').references(() => users.id),
  positionSec: integer('position_sec').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

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
});
