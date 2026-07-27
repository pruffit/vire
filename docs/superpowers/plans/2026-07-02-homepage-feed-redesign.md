# Редизайн главной ленты — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переработать ленту главной `apps/web/app/(listener)/page.tsx` в редакционный ритм: играбельные треки на главной, иммерсивный hero, персональный верх для вошедших, устранение дублей-секций.

**Architecture:** Read-запросы в `packages/db` (queries), реэкспорт из `@vire/db`, вызов прямо в серверной `page.tsx` (действующий паттерн). Играбельные модули — client-компоненты на пропсах из RSC. Новых HTTP-роутов нет. Извлекаем общий `PlayableTrackList` из поиска, чтобы не плодить дубли.

**Tech Stack:** Next.js 15 (App Router, RSC), TypeScript strict, Drizzle ORM (postgres.js), Tailwind v4 (кастомные токены), motion/react, Zustand (плеер).

## Global Constraints

- TypeScript `strict: true`; никаких `any` без комментария-причины.
- **app-shell:** запрещены `min-h-screen` / `h-screen` на страницах/лейаутах (ломает скролл-область). Инвариант защищён `app/__tests__/layout-shell.test.ts`.
- **Drizzle готчи:** JS-`Date` не интерполировать в raw-`sql` — считать дату в SQL (`now() - interval 'N days'` литералом при целом N, либо `make_interval(days => N)`). Колонку в `.select()` не интерполировать — внешнюю таблицу ссылать литералом (`"releases".id`).
- **Минимум комментариев** — только неочевидное «почему».
- **Переиспользование:** искать готовое в `packages/ui` и `apps/web/components`, выносить общее, не дублировать.
- **Мобилка обязательна:** узкий вьюпорт, рейлы `overflow-x-auto`, чарт 1 колонка → 2.
- **Impeccable по умолчанию:** контраст текста на цвете, без pure-gray, без bounce-easing; `audit:design` — гейт.
- Гейты перед «готово»: `pnpm --filter @vire/web typecheck | lint | check:routes | test | audit:design | build`.
- **Секции главной обёрнуты в `.catch(() => [])`** в `Promise.all` — страница не падает из-за одной секции.
- Версия при шипе — в двух местах: корневой `package.json` + `apps/web/package.json`.

**Существующие паттерны для опоры (читать перед кодом):**
- Запросы-образцы: `packages/db/src/queries/discovery.ts` (`getTracksByIds`, `getArtistPlayableTracks`, `releaseCardColumns`, `releaseIsAired`, `releaseFreshness`), `packages/db/src/queries/admin.ts` (`getAdminTopTracks`).
- Играбельная строка трека: `apps/web/components/search-tracks-section.tsx`.
- Плеер: `apps/web/store/player.ts` (`usePlayerStore`, `PlayerTrack`), `apps/web/components/player/audio-engine.ts` (`controls.play(track, queue, index)`, `controls.togglePlay()`, `initAudioEngine()`).
- Секция-заголовок: `apps/web/components/listener/section.tsx`.
- Карточки: `apps/web/components/release-quick-look.tsx`, `editorial-playlist-card.tsx`, `artist-hover-chip.tsx`.
- Дискавери-виджеты: `apps/web/components/wave-start-button.tsx`, `mood-wave-chips.tsx`, `listening-now.tsx`, `featured-release.tsx`.

---

### Task 1: DB — новые discovery-запросы + accentColor у релиза

**Files:**
- Modify: `packages/db/src/queries/discovery.ts` (добавить `accentColor` в `releaseCardColumns` и в `DiscoveryRelease`; три новых запроса)
- Modify: `packages/db/src/index.ts:33-34` (реэкспорт новых функций/типов)

**Interfaces:**
- Consumes: `db`, схемы `tracks, releases, artistProfiles, playEvents, likes, follows` из `../schema`; хелперы `releaseIsAired`, `releaseFreshness` из этого же файла.
- Produces:
  - `interface DiscoveryRelease { …existing…; accentColor: string | null }`
  - `interface PlayableChartTrack { id: string; title: string; artistName: string; artistSlug: string; releaseId: string; coverUrl: string | null; accentColor: string | null; isExplicit: boolean; plays: number }`
  - `getPopularTracks(days?: number, limit?: number): Promise<PlayableChartTrack[]>`
  - `getRecentlyPlayed(userId: string, limit?: number): Promise<PlayableChartTrack[]>` (поле `plays` = 0, не считаем)
  - `getPersonalTrackPicks(userId: string, limit?: number): Promise<PlayableChartTrack[]>`

- [ ] **Step 1: Добавить `accentColor` в `releaseCardColumns` и тип**

В `packages/db/src/queries/discovery.ts` в `interface DiscoveryRelease` добавить поле:
```ts
  hasExplicit: boolean;
  accentColor: string | null;
```
В объект `releaseCardColumns` добавить (по образцу `getTracksByIds`):
```ts
  hasExplicit: sql<boolean>`exists (select 1 from "tracks" t where t.release_id = "releases".id and t.is_explicit)`,
  accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
```

- [ ] **Step 2: Добавить импорты `likes`, `follows`**

В строке импорта схем файла добавить `likes, follows`:
```ts
import { artistProfiles, playEvents, releases, tracks, likes, follows } from '../schema';
```

- [ ] **Step 3: Добавить тип и три запроса в конец `discovery.ts`**

```ts
export interface PlayableChartTrack {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  plays: number;
}

const playableTrackColumns = {
  id: tracks.id,
  title: tracks.title,
  artistName: artistProfiles.name,
  artistSlug: artistProfiles.slug,
  releaseId: releases.id,
  coverUrl: releases.coverUrl,
  accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
  isExplicit: tracks.isExplicit,
};

/** Публичный чарт: самые слушаемые READY-треки за N дней. */
export async function getPopularTracks(days = 30, limit = 20): Promise<PlayableChartTrack[]> {
  const rows = await db
    .select({ ...playableTrackColumns, plays: count(playEvents.id) })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(
      sql`${playEvents.startedAt} >= now() - make_interval(days => ${days})`,
      eq(tracks.status, 'READY'),
      eq(artistProfiles.isActive, true),
      releaseIsAired,
    ))
    .groupBy(tracks.id, tracks.title, artistProfiles.name, artistProfiles.slug, releases.id, releases.coverUrl, artistProfiles.themeTokens, tracks.isExplicit)
    .orderBy(desc(count(playEvents.id)))
    .limit(limit);
  return rows.map((r) => ({ ...r, plays: Number(r.plays) }));
}

/** «Продолжить слушать»: недавно игранные юзером READY-треки, без повторов, свежие сверху. */
export async function getRecentlyPlayed(userId: string, limit = 12): Promise<PlayableChartTrack[]> {
  const rows = await db
    .select({ ...playableTrackColumns, lastAt: sql<string>`max(${playEvents.startedAt})` })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(
      eq(playEvents.userId, userId),
      eq(tracks.status, 'READY'),
      eq(artistProfiles.isActive, true),
      releaseIsAired,
    ))
    .groupBy(tracks.id, tracks.title, artistProfiles.name, artistProfiles.slug, releases.id, releases.coverUrl, artistProfiles.themeTokens, tracks.isExplicit)
    .orderBy(desc(sql`max(${playEvents.startedAt})`))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id, title: r.title, artistName: r.artistName, artistSlug: r.artistSlug,
    releaseId: r.releaseId, coverUrl: r.coverUrl, accentColor: r.accentColor,
    isExplicit: r.isExplicit, plays: 0,
  }));
}

/**
 * «Для тебя»: READY-треки артистов, которых юзер лайкал (артисты его лайкнутых
 * треков) или на кого подписан. Порядок — свежесть релиза + прослушивания.
 * Cold-start (нет лайков и подписок) → пустой массив (модуль скрывается).
 * Без ML — прагматичная выборка по имеющимся сигналам.
 */
export async function getPersonalTrackPicks(userId: string, limit = 12): Promise<PlayableChartTrack[]> {
  // Артисты интереса: из лайкнутых треков ∪ из подписок.
  const likedArtists = db
    .select({ artistProfileId: releases.artistProfileId })
    .from(likes)
    .innerJoin(tracks, eq(tracks.id, likes.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(eq(likes.userId, userId));
  const followedArtists = db
    .select({ artistProfileId: follows.artistProfileId })
    .from(follows)
    .where(eq(follows.userId, userId));

  const rows = await db
    .select({ ...playableTrackColumns, plays: count(playEvents.id) })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(playEvents, eq(playEvents.trackId, tracks.id))
    .where(and(
      eq(tracks.status, 'READY'),
      eq(artistProfiles.isActive, true),
      releaseIsAired,
      or(
        inArray(releases.artistProfileId, likedArtists),
        inArray(releases.artistProfileId, followedArtists),
      ),
    ))
    .groupBy(tracks.id, tracks.title, artistProfiles.name, artistProfiles.slug, releases.id, releases.coverUrl, artistProfiles.themeTokens, tracks.isExplicit, sql`coalesce(${releases.publishedAt}, ${releases.releaseDate}, ${releases.createdAt})`)
    .orderBy(desc(releaseFreshness), desc(count(playEvents.id)))
    .limit(limit);
  return rows.map((r) => ({ ...r, plays: Number(r.plays) }));
}
```
Убедиться, что `count`, `desc`, `and`, `or`, `eq`, `inArray`, `sql` уже импортированы вверху `discovery.ts` (они там есть — строка 1).

- [ ] **Step 4: Реэкспорт из `@vire/db`**

В `packages/db/src/index.ts` строку 33-34 расширить:
```ts
export { getLatestReleases, getUpcomingReleases, getUpcomingByArtist, getTracksByIds, listReleases, getExplicitReleaseIds, getArtistPlayableTracks, getPopularTracks, getRecentlyPlayed, getPersonalTrackPicks } from './queries/discovery';
export type { DiscoveryRelease, DiscoveryTrack, ReleaseSort, ArtistPlayableTrack, PlayableChartTrack } from './queries/discovery';
```

- [ ] **Step 5: Тайпчек**

Run: `pnpm --filter @vire/web typecheck`
Expected: PASS (web импортирует `@vire/db`; новые функции/типы попадают в программу через реэкспорт). Если падает на `accentColor` в местах, где строится `DiscoveryRelease` — проверить, что все они идут через `releaseCardColumns` (менять их не нужно).

> Примечание: DB-запросы бьют в базу — unit-тестами не покрываем (текущий подход VireMusic). Верификация — тайпчек здесь + визуальная проверка модулей в задачах-потребителях.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/discovery.ts packages/db/src/index.ts
git commit -m "feat(db): getPopularTracks/getRecentlyPlayed/getPersonalTrackPicks + accentColor у релиза"
```

---

### Task 2: Общий `PlayableTrackList` (извлечь из поиска)

**Files:**
- Create: `apps/web/components/track-list.tsx`
- Modify: `apps/web/components/search-tracks-section.tsx` (переезд на общий компонент)

**Interfaces:**
- Consumes: `usePlayerStore`, `controls`, `initAudioEngine`, `PlayerLikeButton`, иконки `PlayIcon/PauseIcon`, `formatCount` из `@/lib/format`, `ExplicitBadge`.
- Produces:
  - `interface PlayableTrackItem { id: string; title: string; artistName: string; artistSlug: string; releaseId: string; coverUrl: string | null; isExplicit?: boolean; plays?: number }`
  - `PlayableTrackList({ tracks, variant?, columns? }: { tracks: PlayableTrackItem[]; variant?: 'plain' | 'ranked'; columns?: 1 | 2 })` — client component.

- [ ] **Step 1: Создать `apps/web/components/track-list.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { usePlayerStore } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';
import type { PlayerTrack } from '@/store/player';
import { PlayIcon, PauseIcon } from '@/components/icons';
import { ExplicitBadge } from '@/components/explicit-badge';
import { formatCount } from '@/lib/format';
import { PlayerLikeButton } from './player-like-button';

export interface PlayableTrackItem {
  id: string;
  title: string;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  isExplicit?: boolean;
  plays?: number;
}

export function PlayableTrackList({
  tracks,
  variant = 'plain',
  columns = 2,
}: {
  tracks: PlayableTrackItem[];
  variant?: 'plain' | 'ranked';
  columns?: 1 | 2;
}) {
  useEffect(() => { initAudioEngine(); }, []);

  const queue: PlayerTrack[] = tracks.map((t) => ({
    id: t.id, title: t.title, artistName: t.artistName,
    coverUrl: t.coverUrl, artistSlug: t.artistSlug, releaseId: t.releaseId,
    isExplicit: t.isExplicit,
  }));

  const grid = columns === 2 ? 'grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8' : 'grid grid-cols-1';

  return (
    <Stagger step={0.03} className={grid}>
      {tracks.map((t, i) => (
        <StaggerItem key={t.id}>
          <Row track={t} queue={queue} index={i} rank={variant === 'ranked' ? i + 1 : null} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function Row({
  track, queue, index, rank,
}: {
  track: PlayableTrackItem;
  queue: PlayerTrack[];
  index: number;
  rank: number | null;
}) {
  const isActive = usePlayerStore((s) => s.track?.id === track.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  function handleClick() {
    if (isActive) controls.togglePlay();
    else controls.play(queue[index], queue, index);
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      className="group flex items-center gap-3 py-3 border-b border-border/60 hover:bg-accent/5 -mx-2 px-2 rounded-sm transition-colors cursor-pointer select-none"
    >
      {rank != null && (
        <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
          {rank}
        </span>
      )}
      <div className="relative w-9 h-9 shrink-0 rounded-sm overflow-hidden bg-muted">
        {track.coverUrl ? (
          <Image src={track.coverUrl} alt={track.title} fill quality={60} sizes="36px" className="object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {isActive && isPlaying ? <PauseIcon size={12} className="text-white" /> : <PlayIcon size={12} className="text-white" />}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate flex items-center gap-1.5" style={isActive ? { color: 'var(--primary)' } : undefined}>
          <span className="truncate">{track.title}</span>
          {track.isExplicit && <ExplicitBadge />}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
      </div>
      {track.plays != null && track.plays > 0 && (
        <span className="shrink-0 text-xs font-mono tabular-nums text-muted-foreground hidden sm:block group-hover:opacity-0 transition-opacity">
          {formatCount(track.plays)}
        </span>
      )}
      <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <PlayerLikeButton trackId={track.id} size="sm" />
      </span>
    </motion.div>
  );
}
```

- [ ] **Step 2: Проверить экспорт `formatCount`**

Run: `grep -n "export function formatCount" apps/web/lib/format.ts`
Expected: найдено. Если имя другое (напр. `formatPlays`) — использовать существующее и поправить импорт/вызов в Step 1.

- [ ] **Step 3: Переселить поиск на общий компонент**

Заменить содержимое `apps/web/components/search-tracks-section.tsx` на тонкую обёртку:
```tsx
'use client';

import type { SearchTrack } from '@vire/db';
import { PlayableTrackList } from './track-list';

export function SearchTracksSection({ tracks }: { tracks: SearchTrack[] }) {
  return (
    <PlayableTrackList
      variant="plain"
      columns={2}
      tracks={tracks.map((t) => ({
        id: t.id, title: t.title, artistName: t.artistName,
        artistSlug: t.artistSlug, releaseId: t.releaseId, coverUrl: t.coverUrl,
      }))}
    />
  );
}
```
(`SearchTrack` не имеет `isExplicit` — ок, поле опционально.)

- [ ] **Step 4: Тайпчек + тесты + аудит**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test && pnpm --filter @vire/web audit:design`
Expected: PASS. Поиск (`/search`) должен рендерить треки как раньше.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/track-list.tsx apps/web/components/search-tracks-section.tsx
git commit -m "refactor(web): извлечь общий PlayableTrackList, поиск на нём"
```

---

### Task 3: Featured hero — «иммерсивный акцент»

**Files:**
- Modify: `apps/web/components/featured-release.tsx` (переписать вёрстку; использовать `release.accentColor`)

**Interfaces:**
- Consumes: `DiscoveryRelease` (теперь с `accentColor`), `FeaturedPlayButton`, `ExplicitBadge`, `Icon`, `releaseYear`.
- Produces: тот же экспорт `FeaturedRelease({ release }: { release: DiscoveryRelease })`.

- [ ] **Step 1: Переписать `featured-release.tsx`**

Ключевые решения: подложка = тёмная база + цветное свечение из `accentColor` (radial + linear), поверх — размытая обложка очень слабо (только если accent дефолтный-нейтральный). Обложка справа — резкий арт-объект. Контраст: текст белый, под текстом затемняющий градиент. LCP: `priority` + `fetchPriority=high` на резкой обложке, без opacity-анимации на изображении.

```tsx
import Image from 'next/image';
import Link from 'next/link';
import type { DiscoveryRelease } from '@vire/db';
import { FeaturedPlayButton } from './featured-play-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { Icon } from '@/components/icon';
import { releaseYear } from '@/lib/format';

const typeLabel: Record<string, string> = {
  ALBUM: 'Альбом', SINGLE: 'Сингл', EP: 'EP', COMPILATION: 'Сборник',
};

// Дефолтный нейтральный accent из темы — на нём одного цвета мало, подмешиваем блюр обложки.
const NEUTRAL_ACCENT = '#4a5568';

export function FeaturedRelease({ release }: { release: DiscoveryRelease }) {
  const yr = releaseYear(release.releaseDate);
  const href = `/artists/${release.artistSlug}/releases/${release.id}`;
  const meta = [typeLabel[release.type] ?? release.type, yr].filter(Boolean).join(' · ');
  const hasImage = !!release.coverUrl;
  const accent = release.accentColor ?? NEUTRAL_ACCENT;
  const neutral = accent.toLowerCase() === NEUTRAL_ACCENT;

  return (
    <section
      aria-label="Редакционный выбор"
      className="relative h-96 sm:h-[26rem] rounded-2xl overflow-hidden ring-1 ring-inset ring-white/10 isolate"
      style={{ backgroundColor: '#0c0b0a' }}
    >
      {/* Иммерсивный акцент: свечение из цвета релиза */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 120% at 12% 10%, ${accent}66, transparent 55%), linear-gradient(120deg, ${accent}40 0%, transparent 60%)`,
        }}
      />
      {/* Для нейтрального accent — слабый блюр обложки, чтобы не было «серо» */}
      {hasImage && neutral && (
        <Image
          src={release.coverUrl!}
          alt=""
          aria-hidden
          fill
          className="scale-[1.6] object-cover blur-[80px] saturate-[1.5] opacity-60"
          quality={30}
          sizes="(max-width: 768px) 100vw, calc(100vw - 18rem)"
        />
      )}
      {/* Затемнение под текст (контраст) */}
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-black/85 via-black/45 to-black/15" />
      <div aria-hidden className="absolute inset-0 bg-linear-to-r from-black/70 via-black/20 to-transparent" />

      <div className="absolute inset-0 z-10 grid grid-cols-1 items-end gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-10">
        <div className="flex min-w-0 flex-col gap-3">
          <Link
            href={`/artists/${release.artistSlug}`}
            className="self-start text-xs font-mono uppercase tracking-[0.18em] text-white/70 hover:text-white transition-colors"
          >
            {release.artistName}
          </Link>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tighter leading-[1.02] text-balance text-white">
            {release.title}
            {release.hasExplicit && <ExplicitBadge className="ml-2 align-middle" />}
          </h2>
          <p className="text-xs font-mono text-white/70">{meta}</p>
          <div className="flex items-center gap-4 pt-1">
            <FeaturedPlayButton
              releaseId={release.id}
              artistName={release.artistName}
              coverUrl={release.coverUrl}
              artistSlug={release.artistSlug}
            />
            <Link href={href} className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors">
              К релизу <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </div>

        {hasImage && (
          <Link
            href={href}
            aria-label={`${release.title} — к релизу`}
            className="group hidden shrink-0 self-center sm:block"
          >
            <span className="block aspect-square w-44 lg:w-56 overflow-hidden rounded-xl ring-1 ring-white/15 shadow-2xl shadow-black/60 transition-transform duration-300 ease-out group-hover:-translate-y-1">
              <Image
                src={release.coverUrl!}
                alt={`Обложка «${release.title}»`}
                width={224}
                height={224}
                priority
                fetchPriority="high"
                className="h-full w-full object-cover"
                sizes="(max-width: 1024px) 176px, 224px"
              />
            </span>
          </Link>
        )}

        {!hasImage && (
          <div aria-hidden className="hidden sm:grid place-items-center w-44 h-44 rounded-xl bg-white/5 ring-1 ring-white/10">
            <Icon name="music" size={40} className="opacity-30" />
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Проверить `ExplicitBadge` принимает `className`**

Run: `grep -n "className" apps/web/components/explicit-badge.tsx`
Expected: пропс `className` есть (текущий hero уже его передаёт). Если нет — обернуть в `<span className="ml-2 align-middle">`.

- [ ] **Step 3: Тайпчек + аудит (контраст) + сборка**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web audit:design && pnpm --filter @vire/web build`
Expected: PASS. `audit:design` не должен ругаться на контраст (текст белый на затемнении).

- [ ] **Step 4: Визуальная проверка**

Использовать skill `verify` / `run`: открыть `/`, убедиться — свечение под цвет артиста, текст читаем, обложка-объект справа, на мобилке (узкий вьюпорт) обложка не ломает раскладку.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/featured-release.tsx
git commit -m "feat(home): иммерсивный акцент-hero (цвет релиза из темы артиста)"
```

---

### Task 4: Модуль «Горячие треки» (нумерованный чарт)

**Files:**
- Create: `apps/web/components/home/hot-tracks.tsx`

**Interfaces:**
- Consumes: `PlayableTrackList`, `PlayableChartTrack` (маппится в `PlayableTrackItem`).
- Produces: `HotTracks({ tracks }: { tracks: PlayableChartTrack[] })` — server-safe обёртка (без `'use client'`; внутри client-`PlayableTrackList`).

- [ ] **Step 1: Создать `apps/web/components/home/hot-tracks.tsx`**

```tsx
import type { PlayableChartTrack } from '@vire/db';
import { Section } from '@/components/listener/section';
import { PlayableTrackList } from '@/components/track-list';

export function HotTracks({ tracks }: { tracks: PlayableChartTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <Section title="Горячие треки" href="/releases" hrefLabel="Весь каталог">
      <PlayableTrackList variant="ranked" columns={2} tracks={tracks} />
    </Section>
  );
}
```
(`PlayableChartTrack` структурно совместим с `PlayableTrackItem`: содержит все поля + опциональные `isExplicit`, `plays` — передаём как есть.)

- [ ] **Step 2: Тайпчек**

Run: `pnpm --filter @vire/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/home/hot-tracks.tsx
git commit -m "feat(home): модуль «Горячие треки» (играбельный чарт)"
```

---

### Task 5: Модуль «Поток» (Волна + Настроения вместе)

**Files:**
- Create: `apps/web/components/home/flow-block.tsx`

**Interfaces:**
- Consumes: `WaveStartButton`, `MoodWaveChips` (+ тип `MoodChip`).
- Produces: `FlowBlock({ moods }: { moods: MoodChip[] })`.

- [ ] **Step 1: Создать `apps/web/components/home/flow-block.tsx`**

Объединяет запуск волны и настроения в одну карточку-станцию. `WaveStartButton` уже даёт полосу с запуском; настроения — под ней, как «выбери настроение». Без внешних motion-обёрток (scroll-jitter).

```tsx
import type { MoodChip } from '@/components/mood-wave-chips';
import { WaveStartButton } from '@/components/wave-start-button';
import { MoodWaveChips } from '@/components/mood-wave-chips';

export function FlowBlock({ moods }: { moods: MoodChip[] }) {
  return (
    <section aria-label="Поток" className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      {moods.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Или выбери настроение</p>
          <MoodWaveChips moods={moods} />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Убедиться, что `MoodChip` экспортируется**

Run: `grep -n "export interface MoodChip" apps/web/components/mood-wave-chips.tsx`
Expected: найдено (строка 12).

- [ ] **Step 3: Проверить, что `WaveStartButton` ок внутри карточки**

`WaveStartButton` имеет `border-y border-border` — внутри карточки это двойная линия. В Step 1 карточка уже даёт рамку; при желании визуально почистить: обёртка ок как есть (границы разного цвета), не блокер. Оставить, проверить глазами в Task 8.

- [ ] **Step 4: Тайпчек + Commit**

Run: `pnpm --filter @vire/web typecheck`
```bash
git add apps/web/components/home/flow-block.tsx
git commit -m "feat(home): единый блок «Поток» (волна + настроения)"
```

---

### Task 6: Рейл-контейнер + «Продолжить слушать» + «Новое у подписок»

**Files:**
- Create: `apps/web/components/home/cover-rail.tsx` (горизонтальный scroll-x контейнер + компактная карточка трека)
- Create: `apps/web/components/home/recent-rail.tsx` (обёртка «Продолжить слушать» вокруг `CoverRail`)

**Interfaces:**
- Consumes: `PlayableChartTrack`, `usePlayerStore`, `controls`, `PlayIcon/PauseIcon`, `Section`.
- Produces:
  - `CoverRail({ tracks }: { tracks: PlayableChartTrack[] })` — client, играбельные обложки в scroll-x.
  - `RecentRail({ tracks }: { tracks: PlayableChartTrack[] })` — секция «Продолжить слушать».
- «Новое у подписок» рейл собирается из существующего `ReleaseQuickLook` в Task 8 (релизы, не треки) — здесь не дублируем.

- [ ] **Step 1: Создать `apps/web/components/home/cover-rail.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { controls, initAudioEngine } from '@/components/player/audio-engine';
import { PlayIcon, PauseIcon } from '@/components/icons';
import type { PlayableChartTrack } from '@vire/db';

export function CoverRail({ tracks }: { tracks: PlayableChartTrack[] }) {
  useEffect(() => { initAudioEngine(); }, []);
  const queue: PlayerTrack[] = tracks.map((t) => ({
    id: t.id, title: t.title, artistName: t.artistName,
    coverUrl: t.coverUrl, artistSlug: t.artistSlug, releaseId: t.releaseId, isExplicit: t.isExplicit,
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x scrollbar-thin">
      {tracks.map((t, i) => (
        <Cell key={t.id} track={t} queue={queue} index={i} />
      ))}
    </div>
  );
}

function Cell({ track, queue, index }: { track: PlayableChartTrack; queue: PlayerTrack[]; index: number }) {
  const isActive = usePlayerStore((s) => s.track?.id === track.id);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  function play() {
    if (isActive) controls.togglePlay();
    else controls.play(queue[index], queue, index);
  }

  return (
    <div className="shrink-0 w-32 snap-start group">
      <button type="button" onClick={play} aria-label={`Слушать ${track.title}`} className="block w-full text-left">
        <span className="relative block aspect-square rounded-md overflow-hidden bg-muted ring-1 ring-white/5 group-hover:ring-white/20 transition-all">
          {track.coverUrl && (
            <Image src={track.coverUrl} alt={track.title} fill quality={60} sizes="128px" className="object-cover transition-transform duration-500 ease-soft group-hover:scale-[1.04]" />
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/25 transition-colors">
            <span className="opacity-0 group-hover:opacity-100 grid place-items-center w-10 h-10 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-white/30 text-white transition-opacity">
              {isActive && isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={13} className="translate-x-px" />}
            </span>
          </span>
        </span>
        <span className="mt-2 block text-sm font-medium truncate">{track.title}</span>
      </button>
      <Link href={`/artists/${track.artistSlug}`} className="block text-xs text-muted-foreground truncate hover:text-foreground transition-colors">
        {track.artistName}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Проверить утилиту `scrollbar-thin`**

Run: `grep -rn "scrollbar-thin\|scrollbar-none\|scrollbar" apps/web/app/globals.css packages/config 2>/dev/null | head`
Expected: если утилиты нет — убрать класс `scrollbar-thin` (оставить дефолтный скролл) или использовать имеющуюся утилиту скрытия скроллбара. Не изобретать плагин.

- [ ] **Step 3: Создать `apps/web/components/home/recent-rail.tsx`**

```tsx
import type { PlayableChartTrack } from '@vire/db';
import { Section } from '@/components/listener/section';
import { CoverRail } from './cover-rail';

export function RecentRail({ tracks }: { tracks: PlayableChartTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <Section title="Продолжить слушать">
      <CoverRail tracks={tracks} />
    </Section>
  );
}
```

- [ ] **Step 4: Тайпчек + Commit**

Run: `pnpm --filter @vire/web typecheck`
```bash
git add apps/web/components/home/cover-rail.tsx apps/web/components/home/recent-rail.tsx
git commit -m "feat(home): scroll-x рейл + «Продолжить слушать»"
```

---

### Task 7: Сборка страницы — новый порядок, «Для тебя», объединённые «Подборки», рейл подписок

**Files:**
- Modify: `apps/web/app/(listener)/page.tsx` (полная пересборка ленты)

**Interfaces:**
- Consumes: всё из Tasks 1,3–6 + существующие `getPopularTracks/getRecentlyPlayed/getPersonalTrackPicks`, `ListeningNow`, `EditorialPlaylistCard`, `ReleaseQuickLook`, `ArtistHoverChip`, `FeaturedRelease`, `HotTracks`, `FlowBlock`, `RecentRail`, `CoverRail`, `PlayableTrackList`.
- Produces: обновлённая лента в новом порядке зон.

- [ ] **Step 1: Переписать data-fetch и разметку `page.tsx`**

Порядок: Featured → [вошедшим: Продолжить слушать, Для тебя, Новое у подписок (рейл)] → Горячие треки → Поток → Свежие релизы (+Скоро выйдет) → Сейчас слушают → Подборки (объединённые) → Артисты. Каждый персональный модуль самоскрывается.

```tsx
import { auth } from '@/auth';
import {
  getLatestReleases, listReleases, getUpcomingReleases, listActiveArtists,
  getFeed, getMoodCounts, getEditorialPlaylists, getPersonalPlaylists,
  getPopularPlaylists, getPublicUserPlaylists, getLikedPlaylistIds,
  getPopularTracks, getRecentlyPlayed, getPersonalTrackPicks,
} from '@vire/db';
import { ReleaseQuickLook } from '@/components/release-quick-look';
import { ArtistHoverChip } from '@/components/artist-hover-chip';
import { FeaturedRelease } from '@/components/featured-release';
import { ListeningNow } from '@/components/listening-now';
import { EditorialPlaylistCard } from '@/components/editorial-playlist-card';
import { HotTracks } from '@/components/home/hot-tracks';
import { FlowBlock } from '@/components/home/flow-block';
import { RecentRail } from '@/components/home/recent-rail';
import { PlayableTrackList } from '@/components/track-list';
import { getListeningNow } from '@/lib/listening-now';
import { JsonLd } from '@/components/json-ld';
import { Section } from '@/components/listener/section';
import { websiteJsonLd } from '@/lib/structured-data';
import type { Metadata } from 'next';

export const metadata: Metadata = { alternates: { canonical: '/' } };

const GRID = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6';

export default async function HomePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [
    latest, freshWeek, upcoming, artists, feed, listeningNow, moodCounts,
    sharedPlaylists, personalRaw, publicPlaylists, likedPlaylistIds,
    hotTracks, recent, personalPicks,
  ] = await Promise.all([
    getLatestReleases(13),
    listReleases({ sort: 'fresh', sinceDays: 7, limit: 12 }).catch(() => []),
    getUpcomingReleases(8),
    listActiveArtists(),
    userId ? getFeed(userId) : Promise.resolve([]),
    getListeningNow(6),
    getMoodCounts().catch(() => []),
    getEditorialPlaylists(4),
    userId ? getPersonalPlaylists(userId, 4) : Promise.resolve([]),
    getPublicUserPlaylists(8),
    userId ? getLikedPlaylistIds(userId) : Promise.resolve([]),
    getPopularTracks(30, 20).catch(() => []),
    userId ? getRecentlyPlayed(userId, 12).catch(() => []) : Promise.resolve([]),
    userId ? getPersonalTrackPicks(userId, 12).catch(() => []) : Promise.resolve([]),
  ]);

  // Подборки: 4 общих + 4 личных (добор популярным при нехватке), плюс плейлисты слушателей — в одной секции.
  let personalPlaylists = personalRaw;
  if (personalPlaylists.length < 4) {
    const exclude = [...sharedPlaylists, ...personalPlaylists].map((p) => p.id);
    const fill = await getPopularPlaylists(4 - personalPlaylists.length, exclude);
    personalPlaylists = [...personalPlaylists, ...fill];
  }
  const seen = new Set<string>();
  const allPlaylists = [...sharedPlaylists, ...personalPlaylists, ...publicPlaylists]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

  const featured = latest[0] ?? null;
  const weekFresh = freshWeek.filter((r) => r.id !== featured?.id);
  const rest = (weekFresh.length >= 4 ? weekFresh : latest.slice(1)).slice(0, 8);
  const topArtists = artists.slice(0, 12);
  const empty = latest.length === 0 && upcoming.length === 0 && topArtists.length === 0;

  return (
    <main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-16">
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">VireMusic — независимая музыкальная площадка для артистов и слушателей СНГ</h1>

      {featured && <FeaturedRelease release={featured} />}

      {/* Персональный верх (вошедшим, самоскрывается) */}
      {!!userId && <RecentRail tracks={recent} />}

      {!!userId && personalPicks.length > 0 && (
        <Section title="Для тебя">
          <PlayableTrackList variant="plain" columns={2} tracks={personalPicks} />
        </Section>
      )}

      {!!userId && feed.length > 0 && (
        <Section title="Новое у подписок">
          <div className="flex gap-5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {feed.slice(0, 12).map((r) => (
              <div key={r.id} className="shrink-0 w-40 snap-start">
                <ReleaseQuickLook release={r} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Открытия (всем) */}
      <HotTracks tracks={hotTracks} />
      <FlowBlock moods={moodCounts} />

      {/* Каталог (всем) */}
      {rest.length > 0 && (
        <Section title="Свежие релизы" href="/releases" hrefLabel="Посмотреть все">
          <div className={GRID}>
            {rest.map((r) => <ReleaseQuickLook key={r.id} release={r} />)}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Скоро выйдет">
          <div className={GRID}>
            {upcoming.map((r) => <ReleaseQuickLook key={r.id} release={r} upcoming />)}
          </div>
        </Section>
      )}

      <ListeningNow initial={listeningNow} />

      {allPlaylists.length > 0 && (
        <Section title="Подборки">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
            {allPlaylists.map((p) => (
              <EditorialPlaylistCard key={p.id} playlist={p} liked={likedPlaylistIds.includes(p.id)} />
            ))}
          </div>
        </Section>
      )}

      {topArtists.length > 0 && (
        <Section title="Артисты" href="/artists" hrefLabel="Все артисты">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-5">
            {topArtists.map((a) => <ArtistHoverChip key={a.id} artist={a} />)}
          </div>
        </Section>
      )}

      {empty && (
        <p className="text-center text-sm text-muted-foreground py-12">
          Пока пусто. Скоро здесь появится музыка.
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Проверить, что `ReleaseQuickLook` внутри `w-40` не ломается**

`ReleaseQuickLook` — `w-full` карточка; в фиксированной `w-40` обёртке отрендерится корректно (aspect-square). Проверить глазами в Step 5.

- [ ] **Step 3: Полный прогон гейтов**

Run:
```bash
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
Expected: все PASS. Инвариант `layout-shell.test.ts` зелёный (нет `min-h-screen`).

- [ ] **Step 4: Обновить документацию фичи**

Обновить/создать `docs/features/homepage-feed.md` (что делает лента, порядок зон, какие запросы, самоскрытие модулей, где код). Если файла нет — создать по шаблону `docs/features/README.md`.

- [ ] **Step 5: Визуальная проверка (skill `verify`/`run`)**

Открыть `/` гостем и вошедшим:
- Гость: Featured → Горячие треки → Поток → Свежие → Скоро → Live → Подборки → Артисты.
- Вошедший: + Продолжить слушать / Для тебя / Новое у подписок сверху (если есть данные).
- Мобилка: рейлы скроллятся, чарт в 1 колонку, hero не ломается.
- Клик по треку в «Горячих»/«Для тебя»/«Продолжить» — играет, очередь верная.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(listener\)/page.tsx docs/features/homepage-feed.md
git commit -m "feat(home): редакционный ритм ленты — играбельные треки, персональный верх, объединённые подборки"
```

---

### Task 8: Самокритика, версия, финализация

**Files:**
- Modify: `package.json`, `apps/web/package.json` (бамп версии — при шипе)

- [ ] **Step 1: Независимая самокритика (сабагент Sonnet, свежий контекст)**

Дать сабагенту diff ветки + VireMusic review-чеклист + gotchas: искать забытое (мобилка, дубли, утечки/ререндеры, layout-shell, контраст, краевые случаи — пустой каталог, cold-start, нейтральный accent). Нашёл → чинить и перекритиковать.

- [ ] **Step 2: Повторный прогон всех гейтов**

Run: `typecheck && lint && check:routes && test && audit:design && build` — все зелёные (Iron Law: без свежего вывода не заявлять «готово»).

- [ ] **Step 3: Бамп версии (в двух местах) — при решении шипить**

`package.json` (корень, тег) + `apps/web/package.json` (UI) — одинаковый `X.Y.Z`. `pnpm install` для lockfile, если менялись зависимости (не должны).

- [ ] **Step 4: Финализация ветки**

Использовать skill `superpowers:finishing-a-development-branch` — предложить merge/PR/cleanup.

---

## Self-Review (выполнено при написании плана)

**Покрытие спека:**
- Иммерсивный hero → Task 3. ✓
- Продолжить слушать → Task 1 (`getRecentlyPlayed`) + Task 6. ✓
- Для тебя → Task 1 (`getPersonalTrackPicks`) + Task 7. ✓
- Новое у подписок (рейл) → Task 7. ✓
- Горячие треки → Task 1 (`getPopularTracks`) + Task 4. ✓
- Поток (волна+настроения) → Task 5. ✓
- Свежие + Скоро → Task 7. ✓
- Live → Task 7 (без изменений). ✓
- Подборки объединённые → Task 7. ✓
- Артисты → Task 7. ✓
- Извлечение `PlayableTrackList` → Task 2. ✓
- `accentColor` у релиза → Task 1. ✓
- Гейты/доки/версия → Tasks 7–8. ✓

**Типы согласованы:** `PlayableChartTrack` (Task 1) структурно совместим с `PlayableTrackItem` (Task 2) — все обязательные поля присутствуют, `plays`/`isExplicit` опциональны. `CoverRail`/`HotTracks`/`RecentRail` принимают `PlayableChartTrack[]`. `DiscoveryRelease.accentColor` (Task 1) потребляется в Task 3.

**Плейсхолдеров нет:** все шаги содержат конкретный код/команды. Шаги-проверки (`grep` на `formatCount`, `scrollbar-thin`, `MoodChip`, `ExplicitBadge`) явно указывают fallback, если имя/утилита отличается.
