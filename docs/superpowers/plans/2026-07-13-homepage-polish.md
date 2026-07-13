# Полиш главной (§2.7 + §2.3 + §1.8) — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полиш главной по критике 27/40 (один авто-анонс за визит, rails вместо «мёртвых» сеток, TE-ридаут hero, ритм секций), снятие последнего композит-промоутера (Stagger в трек-листах) и чистка комментариев в затронутых файлах.

**Architecture:** Только presentational-слой apps/web + один новый read-запрос в `packages/db` (getReleaseCardStats). Никаких новых компонентов — переиспользуем ScrollRow/Section/ReleaseQuickLook/ArtistHoverChip. Спека: `docs/superpowers/specs/2026-07-13-homepage-polish-design.md`.

**Tech Stack:** Next.js 15 App Router, Tailwind v4, motion/react, Drizzle, Vitest.

## Global Constraints

- Запрещены `min-h-screen`/`h-screen` на страницах (app-shell), вложенные карточки, side-stripe borders, gradient text, em-dash в копи.
- Внутри скролл-области — никаких постоянных blur/transform/opacity<1/infinite-анимаций (композит-слои → джиттер). Пульс — только `animate-live-pulse`.
- Комментарии — только неочевидное «почему», 1–2 строки; пересказы «что делает» удалять, реальные quirks сохранять.
- Никакого поиска/слоганов на главной.
- Гейты после каждой задачи: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test` (короткий цикл); полный набор — в финальной задаче.
- Коммит после каждой задачи.

---

### Task 1: Один авто-анонс за визит

**Files:**
- Create: `apps/web/lib/announcements-queue.ts`
- Create: `apps/web/lib/announcements-queue.test.ts`
- Modify: `apps/web/components/announcements.tsx`

**Interfaces:**
- Produces: `nextAutoAnnouncement<T extends { storageKey: string }>(list: readonly T[], isSeen: (key: string) => boolean): T | null` — первый непросмотренный элемент очереди или null.

- [ ] **Step 1: Failing test**

`apps/web/lib/announcements-queue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextAutoAnnouncement } from './announcements-queue';

const list = [
  { id: 'a', storageKey: 'k_a' },
  { id: 'b', storageKey: 'k_b' },
] as const;

describe('nextAutoAnnouncement', () => {
  it('возвращает первый непросмотренный', () => {
    expect(nextAutoAnnouncement(list, () => false)?.id).toBe('a');
  });

  it('пропускает просмотренные', () => {
    expect(nextAutoAnnouncement(list, (k) => k === 'k_a')?.id).toBe('b');
  });

  it('null, когда всё просмотрено', () => {
    expect(nextAutoAnnouncement(list, () => true)).toBeNull();
  });

  it('null на пустой очереди', () => {
    expect(nextAutoAnnouncement([], () => false)).toBeNull();
  });
});
```

- [ ] **Step 2: Прогнать — FAIL** (`pnpm --filter @vire/web test announcements-queue` — модуль не найден)

- [ ] **Step 3: Реализация**

`apps/web/lib/announcements-queue.ts`:

```ts
export function nextAutoAnnouncement<T extends { storageKey: string }>(
  list: readonly T[],
  isSeen: (key: string) => boolean,
): T | null {
  return list.find((a) => !isSeen(a.storageKey)) ?? null;
}
```

- [ ] **Step 4: Прогнать — PASS**

- [ ] **Step 5: Компонент — не показывать следующий авто-анонс в том же маунте**

В `apps/web/components/announcements.tsx`:
1. Импорт: `import { nextAutoAnnouncement } from '@/lib/announcements-queue';`
2. Заменить состояние `const [, bump] = useState(0);` на `const [autoConsumed, setAutoConsumed] = useState(false);`
3. `useSyncExternalStore`-геттер оставить (SSR-безопасное чтение), но через хелпер:
   `() => nextAutoAnnouncement(ANNOUNCEMENTS, isSeen)?.id ?? null`
4. Активный: `const active = ANNOUNCEMENTS.find((a) => a.id === (manualId ?? (autoConsumed ? null : autoActiveId))) ?? null;`
5. В `close()` ветку авто заменить на:

```ts
} else {
  markSeen(active.storageKey);
  setAutoConsumed(true); // максимум один авто-анонс за визит; следующий — при следующем заходе
}
```

Комментарий у очереди «Координатор одноразовых анонсов — показываются по одному из очереди, не разом.» обновить: «Авто-показ: максимум один анонс за визит; остальные — в следующие заходы. Версионируй storageKey (…_v1 → _v2), чтобы показать анонс заново всем.»

- [ ] **Step 6: Гейты** `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test`

- [ ] **Step 7: Commit** `git add -A && git commit -m "fix(2.7): один авто-анонс за визит — стек модалок первому гостю снят"`

---

### Task 2: getReleaseCardStats в @vire/db

**Files:**
- Modify: `packages/db/src/queries/discovery.ts` (рядом с DiscoveryRelease-блоком)
- Modify: `packages/db/src/index.ts` (экспорт)

**Interfaces:**
- Produces: `getReleaseCardStats(releaseId: string): Promise<ReleaseCardStats>` где `interface ReleaseCardStats { trackCount: number; totalDurationSec: number }`. Считает ТОЛЬКО треки со `status = 'READY'` данного релиза; `sum` через `coalesce` → 0.

- [ ] **Step 1: Реализация** (юнит-тестов на db-запросы в репо нет — гейт typecheck)

В `packages/db/src/queries/discovery.ts` (импорты `tracks`, `sql`, `and`, `eq` уже есть в файле — проверить и дополнить):

```ts
export interface ReleaseCardStats {
  trackCount: number;
  totalDurationSec: number;
}

export async function getReleaseCardStats(releaseId: string): Promise<ReleaseCardStats> {
  const [row] = await db
    .select({
      trackCount: sql<number>`count(*)::int`,
      totalDurationSec: sql<number>`coalesce(sum(${tracks.durationSec}), 0)::int`,
    })
    .from(tracks)
    .where(and(eq(tracks.releaseId, releaseId), eq(tracks.status, 'READY')));
  return row ?? { trackCount: 0, totalDurationSec: 0 };
}
```

В `packages/db/src/index.ts` — добавить `getReleaseCardStats` к экспортам из `./queries/discovery` и `ReleaseCardStats` к type-экспортам.

- [ ] **Step 2: Гейты** `pnpm --filter @vire/db typecheck`

- [ ] **Step 3: Commit** `git commit -m "feat(db): getReleaseCardStats — треки/длительность релиза для hero"`

---

### Task 3: Section — mono-счётчик рядом со ссылкой

**Files:**
- Modify: `apps/web/components/listener/section.tsx`

**Interfaces:**
- Consumes/Produces: проп `count?: number` уже есть; меняется только рендер — счётчик показывается И при `href`.

- [ ] **Step 1: Реализация**

Заменить блок `{href ? (...) : count != null && count > 0 ? (...) : null}` на независимый рендер обоих:

```tsx
<div className="flex items-baseline gap-3">
  {count != null && count > 0 && (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
  )}
  {href && (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {hrefLabel ?? 'Все'}
      <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  )}
  {action}
</div>
```

(внешний `flex items-center gap-3` меняется на `items-baseline`, чтобы mono-цифра стояла по базовой линии с ссылкой).

- [ ] **Step 2: Гейты + Commit** `git commit -m "feat(2.7): Section — mono-счётчик виден и при ссылке"`

---

### Task 4: FeaturedRelease — TE-ридаут + чистка комментов

**Files:**
- Modify: `apps/web/components/featured-release.tsx`

**Interfaces:**
- Consumes: `ReleaseCardStats` из `@vire/db` (Task 2); `pluralTracks`, `formatDuration` из `@/lib/format`.
- Produces: проп `stats?: ReleaseCardStats | null` у `FeaturedRelease` (по умолчанию отсутствует — мета как раньше).

- [ ] **Step 1: Реализация**

1. Сигнатура: `export function FeaturedRelease({ release, stats }: { release: DiscoveryRelease; stats?: ReleaseCardStats | null })`.
2. Мета-строка:

```ts
const meta = [
  typeLabel[release.type] ?? release.type,
  yr,
  stats && stats.trackCount > 0 ? `${stats.trackCount} ${pluralTracks(stats.trackCount)}` : null,
  stats && stats.totalDurationSec > 0 ? formatDuration(stats.totalDurationSec) : null,
].filter(Boolean).join(' · ');
```

3. §1.8: удалить комментарии-пересказы `{/* Затемнение под текст (контраст) */}` и `{/* Иммерсивный акцент: свечение из цвета релиза */}`; ОСТАВИТЬ quirk `// Дефолтный нейтральный accent…` (строка 13-14) и `{/* Для нейтрального accent: слабый блюр…, чтобы не было «серо» */}` — это «почему».

- [ ] **Step 2: Гейты + Commit** `git commit -m "feat(2.7): hero — mono-ридаут треков и длительности"`

---

### Task 5: page.tsx — rails, масштаб, счётчики, stats

**Files:**
- Modify: `apps/web/app/(listener)/page.tsx`

**Interfaces:**
- Consumes: `getReleaseCardStats` (Task 2), `Section` c count (Task 3), `FeaturedRelease` c stats (Task 4).

- [ ] **Step 1: Реализация**

1. Импорт `getReleaseCardStats` из `@vire/db`.
2. `featured` вычисляется из `latest[0]` ДО Promise.all — нельзя (latest из того же батча). Вместо этого: после основного `Promise.all` добавить

```ts
const featured = latest[0] ?? null;
const featuredStats = featured ? await getReleaseCardStats(featured.id).catch(() => null) : null;
```

(строку `const featured = …` ниже по файлу убрать — она переезжает сюда; `.catch` — секция не роняет страницу).
3. `<FeaturedRelease release={featured} stats={featuredStats} />`.
4. «Свежие релизы»: ширина карточек `w-40` → `w-48`, у `Section` добавить `count={rest.length}`.
5. «Скоро выйдет» — grid → rail (тот же паттерн, что «Свежие релизы», с вертикальным выпуском под hover-тень):

```tsx
{upcoming.length > 0 && (
  <Section title="Скоро выйдет" count={upcoming.length}>
    <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
      {upcoming.map((r) => (
        <div key={r.id} className="shrink-0 w-40 snap-start">
          <ReleaseQuickLook release={r} upcoming />
        </div>
      ))}
    </ScrollRow>
  </Section>
)}
```

6. «Артисты» — grid → rail; айтем `w-28`, hover-превью чипа рендерится вверх (bottom-full) — проверить в браузере, что оно не клипается `overflow-x-auto` (если клипается — вертикальный выпуск увеличить `-my-3 py-3` НЕ решит клип сверху; тогда превью оставить как есть и принять клип только внутри rail-области, зафиксировав в самокритике):

```tsx
{topArtists.length > 0 && (
  <Section title="Артисты" count={topArtists.length} href="/artists" hrefLabel="Все артисты">
    <ScrollRow bleedClassName="-mx-1 -my-2" className="flex gap-5 px-1 py-2 snap-x">
      {topArtists.map((a) => (
        <div key={a.id} className="shrink-0 w-28 snap-start">
          <ArtistHoverChip artist={a} />
        </div>
      ))}
    </ScrollRow>
  </Section>
)}
```

7. Константу `GRID` удалить (больше не используется), `count={allPlaylists.length}` у «Подборки».
8. §1.8: комментарии `{/* «Включи и слушай» — сразу под баннером, всем */}`, `{/* Персональный верх (вошедшим, самоскрывается) */}`, `{/* Открытия (всем) */}`, `{/* Каталог (всем) */}` — удалить (пересказ структуры). ОСТАВИТЬ: `// .catch — главная не должна падать целиком…`, `{/* без FadeUp — FeaturedRelease содержит LCP-изображение… */}`, `{/* -my/py: overflow-x-auto клипает и по Y… */}`, `// на маленьком каталоге неделя бывает пустой…`.

- [ ] **Step 2: Гейты + Commit** `git commit -m "feat(2.7): главная — rails вместо мёртвых сеток, счётчики, w-48"`

---

### Task 6: track-list — снять Stagger (§2.3)

**Files:**
- Modify: `apps/web/components/track-list.tsx`

- [ ] **Step 1: Реализация**

1. Убрать импорт `Stagger, StaggerItem` (оставить `spring` — используется в whileTap; `motion` остаётся).
2. Контейнер:

```tsx
return (
  <div className={`${grid} animate-fade-up`}>
    {tracks.map((t, i) => (
      <Row key={t.id} track={t} queue={queue} index={i} rank={variant === 'ranked' ? i + 1 : null} context={context} />
    ))}
  </div>
);
```

3. Однострочный quirk-коммент над return: `// без Stagger: motion-обёртки держат transform-слой на строках → джиттер скролла; CSS-анимация демотируется по завершении`.

- [ ] **Step 2: Гейты + Commit** `git commit -m "perf(2.3): трек-листы без Stagger — последний композит-промоутер главной снят"`

---

### Task 7: FlowBlock токены + тап-таргет «Запустить»

**Files:**
- Modify: `apps/web/components/home/flow-block.tsx`
- Modify: `apps/web/components/wave-start-button.tsx`

- [ ] **Step 1: FlowBlock — токены**

`bg-white/[0.03] ring-1 ring-white/10` → `bg-foreground/[0.03] ring-1 ring-border`:

```tsx
<section aria-label="Поток" className="rounded-2xl bg-foreground/[0.03] ring-1 ring-border p-5 sm:p-6 space-y-4">
```

- [ ] **Step 2: WaveStartButton — тап-таргет ≥44px**

Обеим кнопкам (`stop` и `start`) добавить невидимое расширение хит-зоны, не меняя высоту строки: `py-3 -my-3 px-2 -mx-2` в className. Пример для start:

```tsx
className="shrink-0 flex items-center gap-1.5 py-3 -my-3 px-2 -mx-2 text-sm font-medium text-foreground hover:opacity-70 transition-opacity disabled:opacity-40"
```

и для stop: `"shrink-0 py-3 -my-3 px-2 -mx-2 text-xs text-muted-foreground hover:text-foreground transition-colors"`.

- [ ] **Step 3: Гейты + Commit** `git commit -m "fix(2.7): FlowBlock на токенах, тап-таргет Запустить ≥44px"`

---

### Task 8: Браузерная верификация + полный прогон гейтов + доки

**Files:**
- Modify: `docs/roadmap/stage-2.md` (§2.7 главная — закрыта; §2.3 — снят Stagger, формулировка про Reveal устарела; §1.8 — отметить пройденные файлы)
- Modify: `docs/features/listener-shell.md` (раздел про главную: rails, один авто-анонс, hero-ридаут)
- Modify: `docs/roadmap/TODO.md` (отложенное из критики: CoverFan fallback, skeleton секций, queue-actions с карточек, чипы)

- [ ] **Step 1: Скриншот-верификация** — dev-сервер на :3000, Playwright: главная 1440×900 и 390×844 (гость), сравнить с «до»: rails без мёртвых полос, ридаут hero, отсутствие горизонтального скролла документа, hover-превью артистов в rail (клип?).
- [ ] **Step 2: Полные гейты** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/core typecheck && pnpm --filter @vire/db typecheck && pnpm --filter @vire/web lint && pnpm --filter @vire/web check:routes && pnpm --filter @vire/web test && pnpm --filter @vire/web audit:design && pnpm --filter @vire/web build` — всё зелёное.
- [ ] **Step 3: Commit** `git commit -m "docs(2.7): итоги полиша главной — stage-2, listener-shell, TODO"`
