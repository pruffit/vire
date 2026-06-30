import { and, asc, count, desc, eq, gt, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { artistProfiles, playEvents, releases, tracks } from '../schema';

export interface DiscoveryRelease {
  id: string;
  title: string;
  type: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  artistName: string;
  artistSlug: string;
  artistAvatarUrl: string | null;
  hasExplicit: boolean;
}

const releaseCardColumns = {
  id: releases.id,
  title: releases.title,
  type: releases.type,
  coverUrl: releases.coverUrl,
  releaseDate: releases.releaseDate,
  artistName: artistProfiles.name,
  artistSlug: artistProfiles.slug,
  artistAvatarUrl: artistProfiles.avatarUrl,
  // Explicit-флаг релиза = любой его трек explicit. Коррелированный EXISTS:
  // внешняя таблица квалифицирована литералом ("releases".id) — Drizzle в .select()
  // рендерит интерполированную колонку без квалификации, что в подзапросе дало бы
  // ambiguity/0 (см. предупреждение в CLAUDE.md). Внутренний tracks под алиасом t.
  hasExplicit: sql<boolean>`exists (select 1 from "tracks" t where t.release_id = "releases".id and t.is_explicit)`,
};

export interface DiscoveryTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
}

/**
 * Множество id релизов (из переданного списка), у которых есть хотя бы один
 * explicit-трек. Для поверхностей, что отдают доменный Release без explicit-данных
 * (страница артиста): один запрос вместо N. Пустой вход → пустое множество.
 */
export async function getExplicitReleaseIds(releaseIds: string[]): Promise<Set<string>> {
  if (releaseIds.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ releaseId: tracks.releaseId })
    .from(tracks)
    .where(and(inArray(tracks.releaseId, releaseIds), eq(tracks.isExplicit, true)));
  return new Set(rows.map((r) => r.releaseId));
}

/** Публично слышимые треки по списку id (для секции «Сейчас слушают»). */
export async function getTracksByIds(ids: string[]): Promise<DiscoveryTrack[]> {
  if (ids.length === 0) return [];
  return db
    .select({
      id: tracks.id,
      title: tracks.title,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      releaseId: releases.id,
      coverUrl: releases.coverUrl,
      accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        inArray(tracks.id, ids),
        eq(tracks.status, 'READY'),
        eq(artistProfiles.isActive, true),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
        ),
      ),
    );
}

/** Свежие релизы по всей платформе (опубликованные / запланированные с прошедшей датой). */
export async function getLatestReleases(limit = 12): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.isActive, true),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(
            eq(releases.status, 'SCHEDULED'),
            isNotNull(releases.releaseDate),
            lte(releases.releaseDate, sql`now()`),
          ),
        ),
      ),
    )
    // Свежесть = момент выхода в эфир. published_at для прямой публикации; для
    // запланированных, открывшихся по дате (published_at ещё null) — release_date;
    // created_at — запасной вариант для легаси-строк без обоих.
    .orderBy(desc(sql`coalesce(${releases.publishedAt}, ${releases.releaseDate}, ${releases.createdAt})`))
    .limit(limit);
}

// Релиз слышен (опубликован / запланирован с прошедшей датой) — тот же предикат,
// что в getLatestReleases. Вынесен, чтобы переиспользовать в каталоге.
const releaseIsAired = or(
  eq(releases.status, 'PUBLISHED'),
  and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
);

// Момент выхода в эфир: published_at → release_date → created_at (см. getLatestReleases).
const releaseFreshness = sql`coalesce(${releases.publishedAt}, ${releases.releaseDate}, ${releases.createdAt})`;

export interface ArtistPlayableTrack {
  id: string;
  title: string;
  releaseId: string;
  coverUrl: string | null;
  durationSec: number | null;
  isExplicit: boolean;
}

/**
 * Играбельные (READY) треки слышимых релизов артиста, в порядке свежести релиза,
 * затем по номеру трека. Для play-all и ридаута на странице артиста: один запрос
 * вместо N fetch'ей по релизам.
 */
export async function getArtistPlayableTracks(artistProfileId: string): Promise<ArtistPlayableTrack[]> {
  return db
    .select({
      id: tracks.id,
      title: tracks.title,
      releaseId: releases.id,
      coverUrl: releases.coverUrl,
      durationSec: tracks.durationSec,
      isExplicit: tracks.isExplicit,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(and(eq(releases.artistProfileId, artistProfileId), eq(tracks.status, 'READY'), releaseIsAired))
    .orderBy(desc(releaseFreshness), asc(tracks.trackNumber))
    .limit(300);
}

export type ReleaseSort = 'fresh' | 'popular';

/**
 * Каталог релизов с сортировкой и опциональным окном по дате выхода.
 * `fresh` — по свежести, `popular` — по числу прослушиваний (треки релиза).
 * `sinceDays` ограничивает витрину релизами за последние N дней.
 */
export async function listReleases({
  sort = 'fresh',
  sinceDays,
  limit = 60,
}: {
  sort?: ReleaseSort;
  sinceDays?: number;
  limit?: number;
} = {}): Promise<DiscoveryRelease[]> {
  const conds = [eq(artistProfiles.isActive, true), releaseIsAired];
  if (sinceDays) {
    // sinceDays — внутреннее число (не пользовательский ввод). Бинд-параметр
    // внутри make_interval/умножения на interval Postgres не может типизировать
    // («could not determine data type of parameter») и запрос падает в рантайме.
    // Поэтому санитизируем в целое и вставляем литералом: now() - interval 'N days'.
    const days = Math.max(0, Math.floor(sinceDays));
    conds.push(sql`${releaseFreshness} >= now() - ${sql.raw(`interval '${days} days'`)}`);
  }

  if (sort === 'popular') {
    // Прослушивания релиза = play-events его треков. left join — релизы без
    // прослушиваний остаются в выдаче с нулём. group by по PK (releases.id,
    // artist_profiles.id) — остальные колонки функционально зависят от них.
    return db
      .select(releaseCardColumns)
      .from(releases)
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .leftJoin(tracks, eq(tracks.releaseId, releases.id))
      .leftJoin(playEvents, eq(playEvents.trackId, tracks.id))
      .where(and(...conds))
      .groupBy(releases.id, artistProfiles.id)
      .orderBy(desc(count(playEvents.id)), desc(releaseFreshness))
      .limit(limit);
  }

  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(...conds))
    .orderBy(desc(releaseFreshness))
    .limit(limit);
}

/** Грядущие релизы конкретного артиста (для страницы артиста / countdown). */
export async function getUpcomingByArtist(artistProfileId: string): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.id, artistProfileId),
        eq(releases.status, 'SCHEDULED'),
        isNotNull(releases.releaseDate),
        gt(releases.releaseDate, sql`now()`),
      ),
    )
    .orderBy(asc(releases.releaseDate));
}

/** Грядущие релизы: запланированы с датой в будущем («скоро выйдет»). */
export async function getUpcomingReleases(limit = 8): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.isActive, true),
        eq(releases.status, 'SCHEDULED'),
        isNotNull(releases.releaseDate),
        gt(releases.releaseDate, sql`now()`),
      ),
    )
    .orderBy(asc(releases.releaseDate))
    .limit(limit);
}
