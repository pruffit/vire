import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { artistProfiles } from './artists';

export const releaseTypeEnum = pgEnum('release_type', ['ALBUM', 'EP', 'SINGLE']);
// Жанры — фиксированный список, заполняет артист (зеркало ALL_GENRES в @vire/core)
export const genreEnum = pgEnum('genre', [
  'ELECTRONIC', 'HIPHOP', 'ROCK', 'INDIE', 'POP', 'AMBIENT', 'JAZZ',
  'CLASSICAL', 'METAL', 'FOLK', 'RNB', 'TECHNO', 'EXPERIMENTAL', 'LOFI',
]);
export const releaseStatusEnum = pgEnum('release_status', ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);
export const trackStatusEnum = pgEnum('track_status', ['PROCESSING', 'READY', 'BLOCKED']);

export const releases = pgTable('releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistProfileId: uuid('artist_profile_id').notNull().references(() => artistProfiles.id),
  title: text('title').notNull(),
  type: releaseTypeEnum('type').notNull().default('ALBUM'),
  genre: genreEnum('genre'),
  coverUrl: text('cover_url'),
  releaseDate: timestamp('release_date'),
  status: releaseStatusEnum('status').notNull().default('DRAFT'),
  description: text('description'),
  linerNotes: text('liner_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  releaseId: uuid('release_id').notNull().references(() => releases.id),
  title: text('title').notNull(),
  trackNumber: integer('track_number').notNull(),
  durationSec: integer('duration_sec'),
  status: trackStatusEnum('status').notNull().default('PROCESSING'),
  // Файл в хранилище всегда по track_id, не по артисту
  // /vault/tracks/{id}/source.flac — политика ухода артиста работает автоматически
  isExclusive: boolean('is_exclusive').notNull().default(false),
  isWip: boolean('is_wip').notNull().default(false),
  // Отображаемые кредиты — для витрины. Финансовые доли — в track_contributors (этап 4)
  credits: jsonb('credits').default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const moodEnum = pgEnum('mood', [
  'MELANCHOLY',
  'NIGHT',
  'DRIVE',
  'AMBIENT',
  'HYPE',
  'CHILL',
  'EPIC',
  'DARK',
  'ROMANTIC',
  'NOSTALGIC',
]);

// Теги настроения — фиксированный список, не свободный ввод (нет UGC/модерации)
// Сырьё для волны ступени 1
export const trackMoods = pgTable('track_moods', {
  trackId: uuid('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  mood: moodEnum('mood').notNull(),
}, (t) => [primaryKey({ columns: [t.trackId, t.mood] })]);

// Медиа-часть трека — заполняется воркером асинхронно
export const trackAudio = pgTable('track_audio', {
  trackId: uuid('track_id').primaryKey().references(() => tracks.id),
  hlsManifestKey: text('hls_manifest_key'),
  // Предрассчитанные пики для waveform — без Web Audio API
  waveformPeaks: jsonb('waveform_peaks'),
  flacKey: text('flac_key'),
  // Аудио-метаданные для волны (ступень 1 — по тегам)
  bpm: integer('bpm'),
  musicalKey: text('musical_key'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
