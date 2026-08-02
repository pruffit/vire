import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core';
import { jamQueueSourceEnum } from './jam';

export const resolutionKeyKindEnum = pgEnum('resolution_key_kind', ['URL', 'QUERY']);

// Кэш резолвов вечеринки: URL/артист+название -> играбельная ссылка либо not_found.
// Экономит квоту YouTube search.list (100 юнитов) — второй и все следующие резолвы бесплатны.
export const externalResolutions = pgTable('external_resolutions', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyKind: resolutionKeyKindEnum('key_kind').notNull(),
  key: text('key').notNull(),
  source: jamQueueSourceEnum('source'),
  externalId: text('external_id'),
  externalUrl: text('external_url'),
  title: text('title'),
  artistName: text('artist_name'),
  coverUrl: text('cover_url'),
  durationSec: integer('duration_sec'),
  notFound: boolean('not_found').notNull().default(false),
  resolvedAt: timestamp('resolved_at').notNull().defaultNow(),
  hits: integer('hits').notNull().default(0),
}, (t) => [
  unique('external_resolutions_key_unique').on(t.keyKind, t.key),
]);
