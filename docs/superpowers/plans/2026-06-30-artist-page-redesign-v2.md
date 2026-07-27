# Страница артиста v2 (две колонки + трек-лист) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Переверстать `/artists/[slug]` в полноширинный двухколоночный макет (липкая карточка артиста слева + лента контента справа) и добавить играбельный блок «Популярное».

**Architecture:** RSC-страница тянет данные из `packages/db`/`packages/core`, рендерит две колонки. Левая колонка sticky внутри app-shell-скроллера `#main-content`. Запрос `getArtistPlayableTracks` обогащается агрегатом `plays`; «Популярное» — чистая сортировка копии массива (хелпер в `apps/web/lib`, покрыт юнитом). Трек-лист — новый клиентский компонент через `controls.play`.

**Tech Stack:** Next.js 15 App Router (RSC + `'use client'`), TypeScript strict, Drizzle (`packages/db`), Tailwind v4 + CSS-переменные темы (`--artist-bg/text/accent`), motion/react, Vitest.

## Global Constraints

- App-shell: НИКАКИХ `min-h-screen`/`h-screen` на странице/лейауте. Высоту даёт скролл-область `#main-content`; страница — `min-h-full`. Sticky-колонка работает внутри этого скроллера. Инвариант защищён `apps/web/app/__tests__/layout-shell.test.ts`.
- Цвет текста на теме — через `color-mix(in oklch, var(--artist-text) NN%, transparent)`, НЕ `opacity` поверх (Impeccable; контраст).
- Тач-таргеты ≥44px (`min-h-11`); ряды переносятся (`flex-wrap`), без горизонтального скролла на мобилке.
- Числа — `tabular-nums` + `font-mono` в ридауте/длительностях.
- Минимум комментариев — только неочевидное «почему».
- `packages/core` не трогаем. Бизнес-логики в компонентах нет.
- Гейты в конце: `typecheck`, `lint`, `check:routes`, `test`, `audit:design`, `build` (через `pnpm --filter @vire/web …`).

---

### Task 1: Обогатить запрос `getArtistPlayableTracks` агрегатом `plays`

**Files:**
- Modify: `packages/db/src/queries/discovery.ts:122-151`

**Interfaces:**
- Produces: `ArtistPlayableTrack` += `plays: number`; `getArtistPlayableTracks(artistProfileId: string): Promise<ArtistPlayableTrack[]>` — порядок выдачи прежний (свежесть релиза → номер трека), теперь с `plays` (all-time count play-events трека).

- [ ] **Step 1: Добавить поле в тип**

В `packages/db/src/queries/discovery.ts` в интерфейсе `ArtistPlayableTrack` добавить поле:

```ts
export interface ArtistPlayableTrack {
  id: string;
  title: string;
  releaseId: string;
  coverUrl: string | null;
  durationSec: number | null;
  isExplicit: boolean;
  plays: number;
}
```

- [ ] **Step 2: Обогатить запрос leftJoin + count + groupBy**

Заменить тело `getArtistPlayableTracks` (импорт `count` уже есть в файле, строка 1):

```ts
export async function getArtistPlayableTracks(artistProfileId: string): Promise<ArtistPlayableTrack[]> {
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      releaseId: releases.id,
      coverUrl: releases.coverUrl,
      durationSec: tracks.durationSec,
      isExplicit: tracks.isExplicit,
      plays: count(playEvents.id),
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .leftJoin(playEvents, eq(playEvents.trackId, tracks.id))
    .where(and(eq(releases.artistProfileId, artistProfileId), eq(tracks.status, 'READY'), releaseIsAired))
    .groupBy(tracks.id, releases.id)
    .orderBy(desc(releaseFreshness), asc(tracks.trackNumber))
    .limit(300);
  return rows.map((r) => ({ ...r, plays: Number(r.plays) }));
}
```

Примечание: `groupBy(tracks.id, releases.id)` — остальные выбранные колонки функционально зависят от этих PK (как в `listReleases` popular-ветке).

- [ ] **Step 3: Typecheck пакета db**

Run: `pnpm --filter @vire/db typecheck`
Expected: PASS (если в db нет отдельного typecheck-скрипта — пропустить, проверится в Task 5 на web build; тогда минимально `pnpm --filter @vire/db build` или общий `pnpm -w typecheck`).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries/discovery.ts
git commit -m "feat(artist): play-count в getArtistPlayableTracks для блока «Популярное»"
```

---

### Task 2: Чистый хелпер сортировки «Популярное» + юнит-тест

**Files:**
- Create: `apps/web/lib/artist-tracks.ts`
- Test: `apps/web/lib/__tests__/artist-tracks.test.ts`

**Interfaces:**
- Produces: `topByPlays<T extends { plays: number }>(tracks: T[], limit?: number): T[]` — стабильная сортировка по `plays` убыв., tie → исходный порядок; при `limit` отдаёт первые `limit`, иначе все.

- [ ] **Step 1: Написать падающий тест**

Создать `apps/web/lib/__tests__/artist-tracks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { topByPlays } from '../artist-tracks';

const t = (id: string, plays: number) => ({ id, plays });

describe('topByPlays', () => {
  it('сортирует по числу прослушиваний убыванию', () => {
    const out = topByPlays([t('a', 1), t('b', 9), t('c', 4)]);
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('при равных plays сохраняет исходный порядок (стабильна)', () => {
    const out = topByPlays([t('a', 5), t('b', 5), t('c', 5)]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('limit ограничивает длину', () => {
    const out = topByPlays([t('a', 1), t('b', 2), t('c', 3)], 2);
    expect(out.map((x) => x.id)).toEqual(['c', 'b']);
  });

  it('не мутирует вход', () => {
    const input = [t('a', 1), t('b', 2)];
    topByPlays(input);
    expect(input.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm --filter @vire/web test -- artist-tracks`
Expected: FAIL — `Cannot find module '../artist-tracks'`.

- [ ] **Step 3: Реализация**

Создать `apps/web/lib/artist-tracks.ts`:

```ts
/**
 * Треки артиста по убыванию прослушиваний. Стабильна: при равных plays
 * сохраняется исходный порядок (порядок каталога из getArtistPlayableTracks),
 * поэтому у нового артиста с нулями «Популярное» = каталог. Вход не мутируется.
 */
export function topByPlays<T extends { plays: number }>(tracks: T[], limit?: number): T[] {
  const sorted = tracks
    .map((track, i) => ({ track, i }))
    .sort((a, b) => b.track.plays - a.track.plays || a.i - b.i)
    .map((x) => x.track);
  return limit == null ? sorted : sorted.slice(0, limit);
}
```

- [ ] **Step 4: Запустить — убедиться, что проходит**

Run: `pnpm --filter @vire/web test -- artist-tracks`
Expected: PASS (4 теста).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/artist-tracks.ts apps/web/lib/__tests__/artist-tracks.test.ts
git commit -m "feat(artist): чистый хелпер topByPlays + тесты"
```

---

### Task 3: Вынести `PlayingBars` в общий компонент (де-дуп)

**Files:**
- Create: `apps/web/components/playing-bars.tsx`
- Modify: `apps/web/app/(listener)/artists/[slug]/releases/[releaseId]/track-list.tsx:176-192` (удалить локальный `PlayingBars`, импортировать общий)

**Interfaces:**
- Produces: `PlayingBars({ animate }: { animate: boolean })` — три полоски-эквалайзер, цвет `var(--artist-accent)`; анимируются пока `animate`.

- [ ] **Step 1: Создать общий компонент**

Создать `apps/web/components/playing-bars.tsx` (точная копия текущей реализации из `track-list.tsx`):

```tsx
/** Маленький эквалайзер: три полоски, анимируются пока трек играет. */
export function PlayingBars({ animate }: { animate: boolean }) {
  return (
    <span className="flex items-end gap-[2px] h-3" style={{ color: 'var(--artist-accent)' }} aria-label="Сейчас играет">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-full"
          style={{
            height: animate ? undefined : '40%',
            animation: animate ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Переключить release track-list на общий**

В `track-list.tsx`: удалить локальную функцию `PlayingBars` (строки ~176-192) и добавить импорт вверху рядом с прочими:

```ts
import { PlayingBars } from '@/components/playing-bars';
```

- [ ] **Step 3: Проверка**

Run: `pnpm --filter @vire/web test -- track-display` (smoke, что ничего рядом не сломалось) и `pnpm --filter @vire/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/playing-bars.tsx "apps/web/app/(listener)/artists/[slug]/releases/[releaseId]/track-list.tsx"
git commit -m "refactor(player): вынести PlayingBars в общий компонент"
```

---

### Task 4: Клиентский блок «Популярное» (играбельный трек-лист)

**Files:**
- Create: `apps/web/app/(listener)/artists/[slug]/artist-popular-tracks.tsx`

**Interfaces:**
- Consumes: `PlayerTrack` (`@/store/player`), `controls.play` (`@/components/player/audio-engine`), `PlayingBars` (Task 3), `PlayerLikeButton`, `ExplicitBadge`, `formatDuration`.
- Produces: `ArtistPopularTracks({ tracks, initialCount = 5 }: { tracks: ArtistPopularTrack[]; initialCount?: number })`, где `ArtistPopularTrack = PlayerTrack & { durationSec: number | null }`. Рендерит секцию-список; кнопка «Все треки (N)» раскрывает полный список (клиентский тоггл). Если `tracks.length === 0` → `null`.

- [ ] **Step 1: Реализация компонента**

Создать `apps/web/app/(listener)/artists/[slug]/artist-popular-tracks.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring, Stagger, StaggerItem } from '@vire/ui/motion';
import { controls } from '@/components/player/audio-engine';
import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { PlayerLikeButton } from '@/components/player-like-button';
import { ExplicitBadge } from '@/components/explicit-badge';
import { PlayingBars } from '@/components/playing-bars';
import { formatDuration } from '@/lib/format';

export type ArtistPopularTrack = PlayerTrack & { durationSec: number | null };

export function ArtistPopularTracks({
  tracks,
  initialCount = 5,
}: {
  tracks: ArtistPopularTrack[];
  initialCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (tracks.length === 0) return null;

  const shown = expanded ? tracks : tracks.slice(0, initialCount);
  const queue: PlayerTrack[] = shown.map(({ durationSec: _d, ...t }) => t);

  function handlePlay(i: number) {
    const track = queue[i];
    if (track) controls.play(track, queue, i);
  }

  return (
    <Stagger step={0.03} className="flex flex-col gap-0.5">
      {shown.map((track, i) => (
        <StaggerItem key={track.id}>
          <Row track={track} rank={i + 1} onPlay={() => handlePlay(i)} />
        </StaggerItem>
      ))}
      {tracks.length > initialCount && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 self-start min-h-11 px-3 text-xs font-mono uppercase tracking-[0.15em] transition-opacity hover:opacity-80"
          style={{ color: 'var(--artist-accent)' }}
        >
          {expanded ? 'Свернуть' : `Все треки (${tracks.length})`}
        </button>
      )}
    </Stagger>
  );
}

function Row({
  track,
  rank,
  onPlay,
}: {
  track: ArtistPopularTrack;
  rank: number;
  onPlay: () => void;
}) {
  const isActive = usePlayerStore((s) => s.track?.id) === track.id;
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={isActive ? () => controls.togglePlay() : onPlay}
      onKeyDown={(e) => e.key === 'Enter' && (isActive ? controls.togglePlay() : onPlay())}
      whileTap={{ scale: 0.99 }}
      transition={spring.snappy}
      className={`group flex items-center gap-4 px-3 py-2.5 rounded-sm cursor-pointer select-none transition-colors hover:bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)] ${
        isActive ? 'bg-[color-mix(in_oklch,var(--artist-text)_7%,transparent)]' : ''
      }`}
    >
      <span className={`w-6 flex justify-end text-xs font-mono tabular-nums shrink-0 ${isActive ? '' : 'opacity-40'}`}>
        {isActive ? <PlayingBars animate={isPlaying} /> : rank}
      </span>

      <div className="flex-1 min-w-0">
        <span
          className="text-sm truncate flex items-center gap-1.5"
          style={isActive ? { color: 'var(--artist-accent)' } : undefined}
        >
          <span className="truncate">{track.title}</span>
          {track.isExplicit && <ExplicitBadge />}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {track.durationSec != null && (
          <span className="text-xs font-mono tabular-nums w-10 text-right" style={{ color: 'color-mix(in oklch, var(--artist-text) 40%, transparent)' }}>
            {formatDuration(track.durationSec)}
          </span>
        )}
        <span
          className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <PlayerLikeButton trackId={track.id} size="sm" />
        </span>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @vire/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(listener)/artists/[slug]/artist-popular-tracks.tsx"
git commit -m "feat(artist): играбельный блок «Популярное»"
```

---

### Task 5: Переверстать `page.tsx` в две колонки + смонтировать «Популярное»

**Files:**
- Modify: `apps/web/app/(listener)/artists/[slug]/page.tsx`

**Interfaces:**
- Consumes: `ArtistPopularTracks`, `ArtistPopularTrack` (Task 4); `topByPlays` (Task 2); существующие `*Section`, `ReleaseHeroPlay`, `FollowButton`/`GuestFollowButton`, `GrainOverlay`, `ArtistCollapseBar`, форматтеры.

Сохраняем как есть (НЕ удалять, НЕ переписывать их внутренности): `UpcomingSection`, `SmartLinksSection`, `ReleasesSection`, `PostsSection`, `VideosSection`, `SectionHeader`, `GuestFollowButton`, `getArtistData`, `generateMetadata`. Меняем только корневой `default export` (root layout + сборку левой карточки) — заменяем прежний `ArtistHero` на `ArtistIdentity` (левая колонка) и добавляем монтаж «Популярного».

- [ ] **Step 1: Добавить импорты**

В шапке `page.tsx` добавить:

```ts
import { ArtistPopularTracks, type ArtistPopularTrack } from './artist-popular-tracks';
import { topByPlays } from '@/lib/artist-tracks';
```

- [ ] **Step 2: Собрать данные «Популярного» в `ArtistPage`**

После существующего `const playQueue: PlayerTrack[] = …` (и `runtime`) добавить.
ВАЖНО — порядок операций: `topByPlays` требует поле `plays`, которого нет в
`ArtistPopularTrack`. Сортируй ИСХОДНЫЙ `playableTracks` (там `plays` есть), и
только потом маппь в `ArtistPopularTrack`:

```ts
  const popularTracks: ArtistPopularTrack[] = topByPlays(playableTracks).map((t) => ({
    id: t.id,
    title: t.title,
    artistName: artist.name,
    coverUrl: t.coverUrl,
    artistSlug: artist.slug,
    releaseId: t.releaseId,
    accentColor: accent ?? undefined,
    isExplicit: t.isExplicit,
    durationSec: t.durationSec,
  }));
```

- [ ] **Step 3: Заменить корневую разметку на две колонки**

Заменить `return ( <div …> … </div> )` в `ArtistPage` (блок с `ArtistHero` + `ArtistCollapseBar` + `<div className="mx-auto max-w-6xl …">`) на:

```tsx
  return (
    <div
      style={
        {
          '--artist-bg': bg,
          '--artist-text': text,
          '--artist-accent': accent,
          background: 'var(--artist-bg)',
          ...artistFontStyle(artist.themeTokens),
        } as React.CSSProperties
      }
      className="min-h-full text-[var(--artist-text)] font-sans"
    >
      <JsonLd
        data={musicGroupJsonLd({
          name: artist.name,
          slug: artist.slug,
          avatarUrl: artist.avatarUrl,
          bio: artist.bio,
          links: artist.links,
        })}
      />
      <JsonLd data={breadcrumbListJsonLd([
        { name: 'Главная', url: '/' },
        { name: 'Артисты', url: '/artists' },
        { name: artist.name, url: `/artists/${artist.slug}` },
      ])} />
      {posts.map((post) => (
        <JsonLd key={post.id} data={artistPostJsonLd(post, { name: artist.name, slug: artist.slug })} />
      ))}
      {grain && <GrainOverlay />}

      {/* Ambient banner — размытая обложка + accent во всю ширину, fade в bg */}
      <ArtistBanner coverUrl={releases[0]?.coverUrl ?? displayAvatar} />

      {/* Компактная полоска при скролле — только мобилка (на lg карточка sticky) */}
      <div className="lg:hidden">
        <ArtistCollapseBar name={artist.name} avatarUrl={displayAvatar} verified={artist.verified} />
      </div>

      <div className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 pb-16 -mt-16 sm:-mt-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[clamp(280px,26%,360px)_1fr] gap-8 lg:gap-12">
          {/* Левая колонка — личность артиста (sticky на lg) */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ArtistIdentity
              artist={artist}
              displayAvatar={displayAvatar}
              followButton={followButton}
              playQueue={playQueue}
              releaseCount={releases.length}
              trackCount={playableTracks.length}
              runtime={runtime}
            />
          </div>

          {/* Правая колонка — лента контента */}
          <div className="min-w-0 flex flex-col gap-14 pt-2 lg:pt-8">
            {upcoming.length > 0 && (
              <UpcomingSection
                upcoming={upcoming}
                artistSlug={artist.slug}
                presavedIds={presavedIds}
                isAuthed={isAuthed}
              />
            )}
            {popularTracks.length > 0 && (
              <section className="animate-fade-up">
                <SectionHeader label="Популярное" />
                <ArtistPopularTracks tracks={popularTracks} />
              </section>
            )}
            <ReleasesSection
              releases={releases}
              explicitReleaseIds={explicitReleaseIds}
              artistSlug={artist.slug}
              artistName={artist.name}
            />
            {smartLinks.length > 0 && <SmartLinksSection smartLinks={smartLinks} artistSlug={artist.slug} />}
            {posts.length > 0 && <PostsSection posts={posts} />}
            {artist.videos.length > 0 && <VideosSection videos={artist.videos} />}
          </div>
        </div>
      </div>
    </div>
  );
```

- [ ] **Step 4: Заменить `ArtistHero` на `ArtistBanner` + `ArtistIdentity`**

Удалить функцию `ArtistHero` (строки ~205-379) и вставить на её место два компонента. `ArtistIdentity` переносит из старого hero: кламп кегля имени, bio через `color-mix`, transport-ряд (`ReleaseHeroPlay` + followButton), mono-ридаут, ряд ссылок (логику ссылок копируем 1:1 из старого hero, включая бренд-подложку). `ArtistBanner` — полноширинная атмосферная полоса.

```tsx
// ─── Banner ────────────────────────────────────────────────────────────────

function ArtistBanner({ coverUrl }: { coverUrl: string | null }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'clamp(180px, 26vh, 320px)' }} aria-hidden="true">
      {coverUrl && (
        <Image
          src={coverUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover scale-110 blur-2xl opacity-40"
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 100% at 50% 0%, color-mix(in oklch, var(--artist-accent) 28%, transparent), transparent 70%), linear-gradient(to bottom, transparent, var(--artist-bg))',
        }}
      />
    </div>
  );
}

// ─── Identity (левая колонка) ────────────────────────────────────────────────

function ArtistIdentity({
  artist,
  displayAvatar,
  followButton,
  playQueue,
  releaseCount,
  trackCount,
  runtime,
}: {
  artist: ArtistProfile;
  displayAvatar: string | null;
  followButton: ReactNode;
  playQueue: PlayerTrack[];
  releaseCount: number;
  trackCount: number;
  runtime: string | null;
}) {
  const readout = [
    releaseCount > 0 ? `${releaseCount} ${pluralReleases(releaseCount)}` : null,
    trackCount > 0 ? `${trackCount} ${pluralTracks(trackCount)}` : null,
    runtime,
  ].filter(Boolean);
  const longestWord = Math.max(1, ...artist.name.split(/\s+/).map((w) => w.length));
  const maxRem = Math.max(2.2, Math.min(4, 22 / longestWord));

  return (
    <div className="flex flex-col gap-5 animate-fade-up">
      <div className="relative w-28 h-28 sm:w-36 sm:h-36">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full blur-2xl opacity-30 scale-150"
          style={{ background: 'var(--artist-accent)' }}
        />
        {displayAvatar ? (
          <Image
            src={displayAvatar}
            alt={artist.name}
            width={280}
            height={280}
            priority
            className="relative z-10 w-full h-full rounded-full object-cover"
            style={{ boxShadow: '0 0 0 1.5px color-mix(in oklch, var(--artist-accent) 50%, transparent)' }}
          />
        ) : (
          <div
            className="relative z-10 w-full h-full rounded-full flex items-center justify-center font-mono"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 3.5rem)',
              background: 'color-mix(in oklch, var(--artist-text) 6%, transparent)',
              opacity: 0.4,
              boxShadow: '0 0 0 1.5px color-mix(in oklch, var(--artist-accent) 50%, transparent)',
            }}
          >
            {artist.name[0]}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h1
          className="font-bold tracking-tight leading-[0.95] text-balance break-words"
          style={{ fontSize: `clamp(2rem, 6vw, ${maxRem}rem)` }}
        >
          {artist.name}
        </h1>
        {artist.verified && <VerifiedBadge />}
      </div>

      {artist.bio && (
        <p
          className="text-sm leading-relaxed"
          style={{ color: 'color-mix(in oklch, var(--artist-text) 62%, transparent)' }}
        >
          {artist.bio}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ReleaseHeroPlay queue={playQueue} />
        {followButton}
      </div>

      {readout.length > 0 && (
        <p
          className="font-mono text-xs tabular-nums"
          style={{ color: 'color-mix(in oklch, var(--artist-text) 45%, transparent)' }}
        >
          {readout.join('  ·  ')}
        </p>
      )}

      {artist.links.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {artist.links.map((link: ArtistLink, i: number) => {
            const key = detectPlatform(link.url).key;
            const name = linkLabel(link.url, link.label);
            const brand = PLATFORM_BRAND[key];
            const wordmark = brand ? isBrandWordmark(brand) : false;
            return (
              <a
                key={`${link.url}-${i}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={name}
                aria-label={name}
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-3 transition-opacity hover:opacity-80"
                style={
                  brand
                    ? { background: '#fff' }
                    : {
                        background: 'color-mix(in oklch, var(--artist-text) 8%, transparent)',
                        color: 'var(--artist-accent)',
                      }
                }
              >
                {brand ? (
                  <BrandIcon name={brand} size={wordmark ? 12 : 16} />
                ) : (
                  <PlatformIcon platform={key} size={16} />
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Прогнать инвариант app-shell + typecheck + lint**

Run:
```bash
pnpm --filter @vire/web test -- layout-shell
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
```
Expected: все PASS (особенно `layout-shell` — нет `min-h-screen`).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(listener)/artists/[slug]/page.tsx"
git commit -m "feat(artist): двухколоночный полноширинный макет + монтаж «Популярного»"
```

---

### Task 6: Гейты + самокритика + документация

**Files:**
- Modify: `docs/features/artist-profile.md`
- Modify: `docs/roadmap/stage-2.md` (§2.7 — отметка о v2)

- [ ] **Step 1: Полный прогон гейтов**

Run (каждый — отдельно, ждать вывода):
```bash
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
Expected: все зелёные. `audit:design` — без новых находок (gray-on-color, контраст, bounce, тач-таргеты).

- [ ] **Step 2: Самокритика независимым сабагентом (Sonnet)**

Дать свежему Sonnet-сабагенту diff + VireMusic-чеклист: мобилка (стопка, тач-таргеты, нет h-scroll), sticky-поведение на lg, дубли, утечки/ререндеры, контраст/gray-on-color, scroll-jitter, краевые случаи (нет треков / нет аватара / 1 релиз / все plays=0 / ≤5 треков). Найденное — чинить и перепрожаривать.

- [ ] **Step 3: Обновить docs/features/artist-profile.md**

Заменить раздел «Hero (редизайн §2.7)» и «Секции» на описание двухколоночного макета (левая sticky-карточка + правая лента), ambient-баннера и нового блока «Популярное» (`topByPlays`, `artist-popular-tracks.tsx`, обогащённый `getArtistPlayableTracks.plays`). Обновить «Где код».

- [ ] **Step 4: Отметить §2.7 в docs/roadmap/stage-2.md**

Дописать к пункту «страница артиста» отметку о v2-редизайне (две колонки + играбельный трек-лист), ссылка на spec/plan `2026-06-30-artist-page-redesign-v2*`.

- [ ] **Step 5: Commit**

```bash
git add docs/features/artist-profile.md docs/roadmap/stage-2.md
git commit -m "docs(artist): обновить фича-док и §2.7 под редизайн v2"
```

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** макет 2 колонки (Task 5) · sticky левая карточка (Task 5) · ambient banner (Task 5) · блок «Популярное» + сортировка (Tasks 1,2,4,5) · play-count в запросе (Task 1) · де-дуп PlayingBars (Task 3) · порядок секций Скоро→Популярное→Релизы→Площадки→Анонсы→Видео (Task 5) · app-shell инвариант (Task 5 Step 5) · краевые случаи (Task 4 `length===0`, `topByPlays` tie-order, `≤5` тоггл) · мобилка/тач (Global Constraints + Task 5) · гейты + самокритика + доки (Task 6). Gap нет.
- **Плейсхолдеры:** нет TBD/TODO; код приведён полностью.
- **Согласованность типов:** `ArtistPlayableTrack.plays` (Task 1) → `topByPlays<T extends {plays}>` (Task 2) применяется к `playableTracks` ДО маппинга → результат маппится в `ArtistPopularTrack = PlayerTrack & {durationSec}` (Task 4, без `plays`). Порядок операций зафиксирован в Task 5 Step 2.
