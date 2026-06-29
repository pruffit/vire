# Страница артиста: редизайн + IA — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Редизайн страницы артиста (`app/(listener)/artists/[slug]/page.tsx`): добавить play-all + mono-ридаут в hero, единый ритм лейбленных секций, чистка ссылок/bio, ревизия движения и мобилки — темизация и все блоки сохраняются.

**Architecture:** Работа во фронт-слое + один новый read-запрос в `packages/db`. Hero получает transport (переиспуем `ReleaseHeroPlay` с очередью треков артиста) и mono-ридаут из агрегатов. Секции получают единый темизированный заголовок (eyebrow + волосяная линия). Никаких изменений backend бизнес-логики/схемы/auth.

**Tech Stack:** Next.js 15 RSC, TypeScript strict, Tailwind v4 (кастомные OKLCH-токены + `--artist-*`), Drizzle ORM, motion/react, Zustand-плеер (`controls.play`).

## Global Constraints

- App-shell инвариант: страница `min-h-full`, **никогда** `min-h-screen`/`h-screen`; единственный скроллер — `#main-content`. Тест `app/__tests__/layout-shell.test.ts` держим зелёным.
- Темизация: компоненты пишутся через `var(--artist-bg/text/accent)`; запрещён `text-white`/`bg-[#hex]` как базовый цвет; нет gradient-text; blur только функциональный.
- Серый текст на цвете запрещён (Impeccable) — вместо `opacity-NN` поверх цвета использовать `color-mix(in oklch, var(--artist-text) NN%, transparent)`.
- Данные (числа/счётчики/хронометраж/теги) — Geist Mono, `tabular-nums`.
- Em-dash запрещён; минимум комментариев (только неочевидное «почему»); тач-таргеты ≥44px.
- Слои: read-запрос — чистая функция в `packages/db`; play-логика — `controls.play` в `'use client'`, без бизнес-правил в компоненте.
- Гейты перед «готово»: `typecheck`, `lint`, `check:routes`, `test`, `audit:design`, `build`.

---

### Task 1: Read-запрос `getArtistPlayableTracks` + загрузка в странице

**Files:**
- Modify: `packages/db/src/queries/discovery.ts` (добавить интерфейс + функцию рядом с `getTracksByIds`)
- Modify: `apps/web/app/(listener)/artists/[slug]/page.tsx:43-59` (`getArtistData` — догрузить играбельные треки)

**Interfaces:**
- Produces: `getArtistPlayableTracks(artistProfileId: string): Promise<ArtistPlayableTrack[]>` где
  `ArtistPlayableTrack = { id: string; title: string; releaseId: string; coverUrl: string | null; durationSec: number | null; isExplicit: boolean }`.
  Возвращает только READY-треки слышимых релизов (PUBLISHED или SCHEDULED с прошедшей датой), упорядоченные по свежести релиза, затем по номеру трека.
- Consumes: существующие `releaseIsAired`, `releaseFreshness` (уже в `discovery.ts`), таблицы `tracks`, `releases`.

- [ ] **Step 1: Добавить запрос в `discovery.ts`**

После `getTracksByIds` (≈ строка 84) вставить:

```ts
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
    .orderBy(desc(releaseFreshness), asc(tracks.trackNumber));
}
```

(Использует уже импортированные `and, asc, desc, eq` и константы `releaseIsAired`, `releaseFreshness` — они объявлены ниже в файле; при необходимости поднять их объявление выше функции, т.к. `const` не хойстится.)

- [ ] **Step 2: Проверить порядок объявлений (const-хойстинг)**

`releaseIsAired`/`releaseFreshness` объявлены ПОСЛЕ `getTracksByIds`. Если новая функция оказывается выше их объявления — она упадёт в рантайме (TDZ). Поставить `getArtistPlayableTracks` НИЖЕ строки с `const releaseFreshness = ...` (≈ строка 120) или переместить обе `const` к началу секции. Выбрать размещение ниже `releaseFreshness`.

- [ ] **Step 3: typecheck пакета db**

Run: `pnpm --filter @vire/db typecheck`
Expected: PASS (нет ошибок типов; функция экспортируется и переэкспортируется через индекс пакета, как соседние запросы).

- [ ] **Step 4: Догрузить треки в `getArtistData`**

В `apps/web/.../[slug]/page.tsx` импорт из `@vire/db` дополнить `getArtistPlayableTracks`. В `Promise.all` добавить вызов и вернуть в объекте:

```ts
const [releases, upcoming, posts, smartLinks, playableTracks] = await Promise.all([
  releaseService.getPublishedByArtist(result.value.id),
  getUpcomingByArtist(result.value.id),
  listArtistPosts(result.value.id, 5),
  getPublishedSmartLinks(result.value.id),
  getArtistPlayableTracks(result.value.id),
]);
// ...
return { artist: result.value, releases, upcoming, posts, smartLinks, explicitReleaseIds, playableTracks };
```

И в `ArtistPage` деструктурировать `playableTracks` из `data`.

- [ ] **Step 5: typecheck web**

Run: `pnpm --filter @vire/web typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/queries/discovery.ts "apps/web/app/(listener)/artists/[slug]/page.tsx"
git commit -m "feat(artist): запрос играбельных треков артиста для play-all и ридаута"
```

---

### Task 2: Темизированный заголовок секции + единый ритм всех секций

**Files:**
- Modify: `apps/web/app/(listener)/artists/[slug]/page.tsx` (новый локальный компонент `SectionHeader` + применить в `UpcomingSection`, `ReleasesSection`, `SmartLinksSection`, `PostsSection`, `VideosSection`)

**Interfaces:**
- Produces: `SectionHeader({ label }: { label: string })` — mono-uppercase eyebrow в `--artist-accent` + волосяная линия в цвете `color-mix(--artist-text 14%)`. Локальный компонент (кандидат на вынос в общий темизированный kit, когда дойдём до релиза/трека — пока один экран, держим локально, не плодим преждевременный shared API).

- [ ] **Step 1: Добавить `SectionHeader`**

В секции утилит страницы:

```tsx
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="font-mono text-xs uppercase tracking-[0.25em]" style={{ color: 'var(--artist-accent)' }}>
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: 'color-mix(in oklch, var(--artist-text) 14%, transparent)' }} />
    </div>
  );
}
```

- [ ] **Step 2: Дать «Релизам» заголовок и причесать остальные**

- `ReleasesSection`: обернуть содержимое — `<SectionHeader label="Релизы" />` над сеткой/одиночной обложкой.
- `UpcomingSection`: `<SectionHeader label="Скоро" />` над списком.
- `SmartLinksSection`: заменить `<h2 className="text-lg font-semibold tracking-tight">Слушать на площадках</h2>` на `<SectionHeader label="Площадки" />` (короткий лейбл в общем ритме).
- `PostsSection`: `<SectionHeader label="Анонсы" />` над списком статей.
- `VideosSection`: `<SectionHeader label="Видео" />` над сеткой.

Все секции остаются обёрнуты в существующие `Reveal` (движение ревизуем в Task 4). Заголовок идёт первым ребёнком `<section>`.

- [ ] **Step 3: lint + build**

Run: `pnpm --filter @vire/web lint && pnpm --filter @vire/web build`
Expected: PASS, страница собирается.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(listener)/artists/[slug]/page.tsx"
git commit -m "feat(artist): единый темизированный заголовок секций (eyebrow + линия)"
```

---

### Task 3: Hero — transport (play-all) + mono-ридаут + чистка ссылок и bio

**Files:**
- Modify: `apps/web/app/(listener)/artists/[slug]/page.tsx` (`ArtistHero` + проброс данных из `ArtistPage`)

**Interfaces:**
- Consumes: `playableTracks: ArtistPlayableTrack[]` (Task 1), `followerCount: number` (уже в `ArtistPage`), `releases: Release[]`, `artist`.
- Consumes: `ReleaseHeroPlay` (`@/components/release-hero-play`) — принимает `queue: PlayerTrack[]`, темизирован, не рендерится при пустой очереди. Переиспользуем как есть.
- Consumes: `PlayerTrack` (`@/store/player`), `formatCount`, `totalDuration`, `pluralTracks`, `pluralReleases`, `plural` (`@/lib/format`).

- [ ] **Step 1: Собрать очередь и агрегаты в `ArtistPage`, пробросить в hero**

В `ArtistPage`, после получения `data`:

```ts
const playQueue: PlayerTrack[] = playableTracks.map((t) => ({
  id: t.id,
  title: t.title,
  artistName: artist.name,
  coverUrl: t.coverUrl,
  artistSlug: artist.slug,
  releaseId: t.releaseId,
  accentColor: accent ?? undefined,
  isExplicit: t.isExplicit,
}));
const runtime = totalDuration(playableTracks.map((t) => ({ status: 'READY', durationSec: t.durationSec })));
```

(`accent` уже деструктурирован из `artist.themeTokens` строкой выше; `PlayerTrack` уже импортирован? — если нет, добавить `import type { PlayerTrack } from '@/store/player';` и `import { totalDuration, formatCount, plural, pluralTracks, pluralReleases } from '@/lib/format';`.)

Передать в `<ArtistHero ... playQueue={playQueue} followerCount={followerCount} releaseCount={releases.length} trackCount={playableTracks.length} runtime={runtime} />`.

- [ ] **Step 2: Расширить пропсы `ArtistHero` и вставить transport**

В сигнатуру `ArtistHero` добавить `playQueue: PlayerTrack[]; followerCount: number; releaseCount: number; trackCount: number; runtime: string | null`.

Заменить блок follow (строка с `{followButton}`) на строку transport: play + follow рядом:

```tsx
<div className="flex flex-wrap items-center gap-3">
  <ReleaseHeroPlay queue={playQueue} />
  {followButton}
</div>
```

(`ReleaseHeroPlay` сам не рендерится при `playQueue.length === 0` — гость/артист без READY-треков увидят только follow.)

- [ ] **Step 3: Mono-ридаут под transport**

Под строкой transport добавить:

```tsx
<p className="font-mono text-xs tabular-nums" style={{ color: 'color-mix(in oklch, var(--artist-text) 45%, transparent)' }}>
  {[
    followerCount > 0 ? `${formatCount(followerCount)} ${plural(followerCount, ['подписчик', 'подписчика', 'подписчиков'])}` : null,
    releaseCount > 0 ? `${releaseCount} ${pluralReleases(releaseCount)}` : null,
    trackCount > 0 ? `${trackCount} ${pluralTracks(trackCount)}` : null,
    runtime,
  ].filter(Boolean).join('  ·  ')}
</p>
```

- [ ] **Step 4: Чистка ссылок (единый визуальный тип)**

В ряду ссылок убрать развилку «белая пилюля бренда / icon+текст»: все ссылки рендерить одним габаритом — иконка площадки/бренда в единой нейтральной таблетке фиксированного размера (≥44px тач-таргет через padding), подпись остаётся в `title`/`aria-label` (без видимого текста, чтобы ряд был ровным). Сохранить бренд-варднмарки внутри таблетки тем же размером. Конкретно: заменить inline-`<a>` на единый стиль:

```tsx
<a
  key={i}
  href={link.url}
  target="_blank"
  rel="noopener noreferrer"
  title={name}
  aria-label={name}
  className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2.5 transition-colors"
  style={{
    background: 'color-mix(in oklch, var(--artist-text) 8%, transparent)',
    color: 'var(--artist-accent)',
  }}
>
  {brand ? <BrandIcon name={brand} size={wordmark ? 12 : 16} /> : <PlatformIcon platform={key} size={16} />}
</a>
```

(Единый контейнер: бренд-иконки больше не на белом фоне — на нейтральной таблетке темы; если конкретный бренд нечитаем без белой подложки, оставить белую подложку ТОЛЬКО для него внутри той же таблетки, но габарит таблетки общий. Решение по читаемости бренд-логотипа — на этапе визуальной проверки Task 5.)

- [ ] **Step 5: Читабельность bio**

Заменить `className="text-sm leading-relaxed opacity-60 max-w-[44ch]"` на убор `opacity-60` и стиль `style={{ color: 'color-mix(in oklch, var(--artist-text) 62%, transparent)' }}`.

- [ ] **Step 6: typecheck + build**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(listener)/artists/[slug]/page.tsx"
git commit -m "feat(artist): transport (play-all) + mono-ридаут в hero, чистка ссылок и bio"
```

---

### Task 4: Ревизия движения (scroll-jitter) + мобильный полиш

**Files:**
- Modify: `apps/web/app/(listener)/artists/[slug]/page.tsx`
- Read (диагностика): `packages/ui/src/motion/*` (что именно делают `Reveal`/`FadeUp`/`Stagger` — промотируют ли композит-слой постоянно)

**Interfaces:**
- Consumes: `Reveal`, `FadeUp`, `Stagger`, `StaggerItem` (`@vire/ui/motion`).

- [ ] **Step 1: Диагностировать `Reveal`/`Stagger`**

Прочитать реализацию `Reveal`/`FadeUp`/`Stagger` в `packages/ui/src/motion`. Определить: остаётся ли после входа постоянный `transform`/`will-change`/3D-слой (память Vire: scroll-jitter = промоутер композита, висящий после анимации). Зафиксировать вывод в сообщении.

- [ ] **Step 2: Решение по движению**

Если `Reveal` оставляет промоутер композита (постоянный `transform: translate`/`will-change`/`translateZ`) → варианты (выбрать минимально инвазивный):
- (a) заменить per-section `Reveal` на CSS `animate-fade-up` (server-friendly, как `content-kit`), у которого нет висящего промоутера; ИЛИ
- (b) если `Reveal` уже корректно снимает `will-change` по завершении (`onAnimationComplete`) — оставить как есть, зафиксировать что jitter не воспроизводится.

Не менять словарь пружин/easing — только устранить висящий промоутер. Stagger карточек (релизы/площадки) — оставить (это «один уровень», разрешено принципами).

- [ ] **Step 3: Мобильный аудит**

Проверить на узком вьюпорте (через `build` + визуальная проверка в Task 5): transport+ридаут переносятся (`flex-wrap`), не дают горизонтального скролла; ряд ссылок переносится; аватар/имя не наезжают; тач-таргеты play/follow/ссылок ≥44px. Поправить классы при необходимости (например `gap`, `flex-wrap`, размеры).

- [ ] **Step 4: Гейты**

Run: `pnpm --filter @vire/web lint && pnpm --filter @vire/web test && pnpm --filter @vire/web build`
Expected: PASS, тест app-shell зелёный.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/app/(listener)/artists/[slug]/page.tsx"
git commit -m "fix(artist): ревизия входной анимации (scroll-jitter) + мобильный полиш"
```

---

### Task 5: Финальная верификация, самокритика, документация

**Files:**
- Modify: `docs/features/` (страница артиста / контентные экраны — если файла нет, создать по шаблону `docs/features/README.md`)
- Modify: `docs/roadmap/stage-2.md` (отметить прогресс §2.7 — артист пройден)

- [ ] **Step 1: Полный прогон гейтов**

Run по очереди, вывод приложить:
```
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
Expected: всё PASS. `audit:design` без новых находок по затронутым файлам.

- [ ] **Step 2: Визуальная проверка (Impeccable)**

Через `/impeccable critique` или live-браузер прогнать страницу артиста: десктоп + узкий вьюпорт. Проверить читаемость bio/ридаута на цветной теме (контраст), ровность ряда ссылок, что play-all реально запускает плеер, пустые состояния (артист без READY-треков — нет кнопки play, ридаут корректен).

- [ ] **Step 3: Самокритика независимым сабагентом (Sonnet, свежий контекст)**

Задача сабагенту: прожарить диф по Vire review-чеклисту и gotchas — мобилка, дубли (не появился ли второй вариант play/section-header), утечки/ререндеры, app-shell (`min-h-screen`), серый-на-цвете, em-dash, лишние комменты. Нашёл проблемы → починить и перепрожарить.

- [ ] **Step 4: Документация**

Обновить/создать файл фичи в `docs/features/` (что делает страница артиста после редизайна, где код, ограничения). Отметить в `docs/roadmap/stage-2.md` §2.7, что страница артиста пройдена (релиз/трек/плеер — впереди).

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(artist): фича-док редизайна страницы артиста + прогресс §2.7"
```

---

## Self-Review (выполнено при написании плана)

**Spec coverage:** hero transport ✓ (Task 3), mono-ридаут ✓ (Task 3), чистка ссылок ✓ (Task 3), bio-контраст ✓ (Task 3), единый ритм секций + заголовок «Релизам» ✓ (Task 2), порядок секций — сохранён (Task 2), read-запрос play-all ✓ (Task 1), ревизия движения/jitter ✓ (Task 4), мобилка ✓ (Task 4), краевые случаи (нет READY → нет play) ✓ (Task 3 Step 2), гейты+самокритика+доки ✓ (Task 5). Live-LED «слушают сейчас» — **намеренно отложен** (спека пометила опциональным; не вводим клиентский поллинг в этом заходе).

**Placeholder scan:** код приведён целиком в каждом шаге; «решение по читаемости бренда» и «решение по движению» — явные развилки с критерием выбора на этапе визуальной проверки, не TODO.

**Type consistency:** `ArtistPlayableTrack` (Task 1) → маппится в `PlayerTrack` (Task 3) с полями, совпадающими с тем, как это делает release-страница (`id,title,artistName,coverUrl,artistSlug,releaseId,accentColor,isExplicit`). `getArtistPlayableTracks` сигнатура едина в Tasks 1 и 3. `totalDuration` принимает `{status,durationSec}[]` — в Task 3 подаём именно такой shape.

**Замечание по TDD:** редизайн server-компонента не покрывается классическим юнит-тестом; новый read-запрос — интеграционный (без локальной DB-инфры юнит-тестов queries в проекте нет). Сетка безопасности здесь: typecheck (сигнатуры), инвариант app-shell (`layout-shell.test.ts`), `build`, `audit:design`, визуальная Impeccable-проверка и самокритика сабагентом. Новых чистых функций, требующих TDD, задача не вводит (ридаут — композиция уже покрытых хелперов `format.ts`).
