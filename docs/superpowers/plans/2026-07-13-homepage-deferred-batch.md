# Пачка «Отложенное из критики главной» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть 5 отложенных пунктов критики главной: CoverFan-фолбэк, стриминг-скелетоны, «Дальше»/«В очередь» с карточек, кап чипов «Потока», тест Announcements.

**Architecture:** Пять файлово-непересекающихся задач. Чистые функции — в `lib/player/queue.ts` и `components/home/wave-chip-items.ts` (юнит-тесты рядом). Главная переводится на RSC-стриминг (`Suspense` + async-секции). Спека: `docs/superpowers/specs/2026-07-13-homepage-deferred-batch-design.md`.

**Tech Stack:** Next.js 15 App Router (RSC, Suspense, React `cache()`), Zustand, Vitest + @testing-library/react (jsdom), Tailwind v4, motion/react.

## Global Constraints

- Комментарии — почти никогда: только неочевидное «почему», 1–2 строки. Не пересказывать «что делает».
- Никаких `min-h-screen`/`h-screen`; скелетоны без бесконечных transform/opacity-анимаций (никакого `animate-pulse`) — анти-джиттер-правило app-shell.
- TS strict, никаких `any`. Тосты — конкретный текст.
- Гейты после каждой задачи: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test` (полный набор — в конце пачки).
- Тач-таргеты новых интерактивов ≥44px (допустим отрицательный margin-хак как в `wave-start-button.tsx`).
- Коммит после каждой задачи.

---

### Task 1: CoverFan fallback на тонком каталоге

**Files:**
- Modify: `packages/db/src/queries/playlists.ts:368-372` (дедуп в `coversByPlaylist`)
- Modify: `apps/web/components/editorial-playlist-card.tsx:30-45` (`buildFan` дедуплицирует вход, экспорт для теста)
- Test: `apps/web/components/editorial-playlist-card.test.ts` (новый)

**Interfaces:**
- Produces: `export function buildFan(covers: string[]): FanLayer[]` (был приватным, принимал уже срезанный stack — теперь сам дедупит и режет до 3).

- [ ] **Step 1: Написать падающий тест на buildFan**

```ts
import { describe, expect, it } from 'vitest';
import { buildFan } from './editorial-playlist-card';

describe('buildFan', () => {
  it('три одинаковые обложки схлопываются в одну плоскую карточку', () => {
    const fan = buildFan(['a.jpg', 'a.jpg', 'a.jpg']);
    expect(fan).toHaveLength(1);
    expect(fan[0]).toMatchObject({ src: 'a.jpg', rot: 0, dx: 0 });
  });

  it('две уникальные из трёх дают веер из двух', () => {
    const fan = buildFan(['a.jpg', 'b.jpg', 'a.jpg']);
    expect(fan).toHaveLength(2);
    expect(fan.map((l) => l.src)).toEqual(expect.arrayContaining(['a.jpg', 'b.jpg']));
  });

  it('три+ уникальных дают полный веер из трёх, лицевая — первая', () => {
    const fan = buildFan(['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg']);
    expect(fan).toHaveLength(3);
    const front = fan.find((l) => l.z >= 30);
    expect(front?.src).toBe('a.jpg');
  });

  it('пустой вход — пустой веер', () => {
    expect(buildFan([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Прогнать — убедиться, что падает** (`buildFan` не экспортируется)

Run: `pnpm --filter @vire/web test editorial-playlist-card`
Expected: FAIL (нет экспорта `buildFan`)

- [ ] **Step 3: Реализация**

В `editorial-playlist-card.tsx`: `buildFan` дедупит и режет сам, `CoverFan` больше не делает `slice`:

```ts
export function buildFan(covers: string[]): FanLayer[] {
  const stack = Array.from(new Set(covers)).slice(0, 3);
  if (stack.length === 0) return [];
  if (stack.length === 1) {
    return [{ src: stack[0], rot: 0, dx: 0, z: 30 }];
  }
  if (stack.length === 2) { /* существующая ветка без изменений */ }
  return [ /* существующая ветка трёх без изменений */ ];
}
```

В `CoverFan`: `const fan = buildFan(covers);`, пустое состояние — `fan.length === 0`, маппинг по `fan`.

В `packages/db/src/queries/playlists.ts` (строка ~371) — не пушить дубль:

```ts
if (list.length < 4 && row.coverUrl && !list.includes(row.coverUrl)) list.push(row.coverUrl);
```

- [ ] **Step 4: Прогнать тесты** — PASS; также `pnpm --filter @vire/db typecheck`.

- [ ] **Step 5: Commit** `fix(home): CoverFan не вырождается в веер одинаковых обложек на тонком каталоге`

---

### Task 2: Компонентный тест Announcements

**Files:**
- Test: `apps/web/components/announcements.test.tsx` (новый; прод-код не меняется)

**Interfaces:**
- Consumes: `Announcements` из `./announcements`, `OPEN_ANNOUNCEMENT_EVENT` из `./widget-triggers` (CustomEvent с `detail: { id }`).

- [ ] **Step 1: Написать тест**

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Announcements } from './announcements';
import { OPEN_ANNOUNCEMENT_EVENT } from './widget-triggers';

// motion в jsdom не завершает exit-анимации — рендерим без них, unmount становится синхронным
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, {
    get: (_t, tag: string) => {
      const C = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
        const dom = Object.fromEntries(
          Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'layoutId'].includes(k)),
        );
        const Tag = tag as 'div';
        return <Tag {...dom}>{children}</Tag>;
      };
      C.displayName = `motion.${tag}`;
      return C;
    },
  }),
}));

describe('Announcements', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('авто-показывает первый непросмотренный анонс', () => {
    render(<Announcements />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Vire запущен')).toBeTruthy();
  });

  it('после закрытия второй анонс НЕ появляется в том же маунте, seen-флаг записан', () => {
    render(<Announcements />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('vire_notice_stage1_v1')).toBe('1');
    expect(screen.queryByText('Изменения во входе')).toBeNull();
  });

  it('в следующем маунте показывается следующий из очереди', () => {
    const first = render(<Announcements />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    first.unmount();

    render(<Announcements />);
    expect(screen.getByText('Изменения во входе')).toBeTruthy();
  });

  it('ручное открытие работает после потребления авто-показа и не пишет seen-флаг', () => {
    render(<Announcements />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));

    fireEvent(window, new CustomEvent(OPEN_ANNOUNCEMENT_EVENT, { detail: { id: 'auth' } }));
    expect(screen.getByText('Изменения во входе')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('vire_notice_auth_v1')).toBeNull();
  });
});
```

- [ ] **Step 2: Прогнать** — `pnpm --filter @vire/web test announcements`. Если мок motion конфликтует с реальным рендером (например, `useSyncExternalStore` идёт до маунта) — чинить тест, не компонент. Ожидание: PASS все 4.

- [ ] **Step 3: Commit** `test(home): компонентный тест Announcements — один авто-анонс за маунт`

---

### Task 3: «Играть следующим» / «В очередь» с карточек хаба

**Files:**
- Modify: `apps/web/lib/player/queue.ts` (+`insertIntoQueue`)
- Test: `apps/web/lib/player/queue.test.ts` (дописать к существующим)
- Modify: `apps/web/lib/player/audio-engine.ts` (+`controls.enqueue`)
- Create: `apps/web/components/track-queue-menu.tsx` (кебаб-меню + хелпер `enqueueWithToast`)
- Modify: `apps/web/components/track-list.tsx` (меню в `trailing` строки)
- Modify: `apps/web/components/release-quick-look.tsx` (действия в peek-шите)

**Interfaces:**
- Produces:
  - `insertIntoQueue(queue: PlayerTrack[], queueIndex: number, tracks: PlayerTrack[], position: 'next' | 'end'): { queue: PlayerTrack[]; inserted: number }`
  - `controls.enqueue(tracks: PlayerTrack[], position: 'next' | 'end', context: PlayContext): number` — число реально вставленных
  - `enqueueWithToast(load: () => Promise<PlayerTrack[] | null> | PlayerTrack[], position: 'next' | 'end', context: PlayContext): Promise<void>` — enqueue + тост
  - `<TrackQueueMenu getTracks={...} context={...} />` — кебаб-кнопка с двумя пунктами

- [ ] **Step 1: Падающие тесты insertIntoQueue** (в `queue.test.ts`)

```ts
import { insertIntoQueue } from './queue';

const t = (id: string) => ({ id, title: id, artistName: 'a', coverUrl: null });

describe('insertIntoQueue', () => {
  const queue = [t('1'), t('2'), t('3')];

  it('next вставляет сразу после текущего', () => {
    const r = insertIntoQueue(queue, 0, [t('9')], 'next');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '9', '2', '3']);
    expect(r.inserted).toBe(1);
  });

  it('end добавляет в конец', () => {
    const r = insertIntoQueue(queue, 1, [t('9'), t('8')], 'end');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '2', '3', '9', '8']);
    expect(r.inserted).toBe(2);
  });

  it('уже стоящие в очереди не дублируются', () => {
    const r = insertIntoQueue(queue, 0, [t('2'), t('9')], 'next');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '9', '2', '3']);
    expect(r.inserted).toBe(1);
  });

  it('всё уже в очереди — inserted 0, очередь та же по ссылке', () => {
    const r = insertIntoQueue(queue, 0, [t('2')], 'next');
    expect(r.inserted).toBe(0);
    expect(r.queue).toBe(queue);
  });

  it('дубли внутри входа схлопываются', () => {
    const r = insertIntoQueue(queue, 2, [t('9'), t('9')], 'next');
    expect(r.queue.map((x) => x.id)).toEqual(['1', '2', '3', '9']);
    expect(r.inserted).toBe(1);
  });
});
```

- [ ] **Step 2: Прогнать — FAIL** (`insertIntoQueue` не существует)

- [ ] **Step 3: Реализация в `queue.ts`**

```ts
/** Вставка в очередь без дублей: треки, уже стоящие в ней, не вставляются повторно. */
export function insertIntoQueue(
  queue: PlayerTrack[],
  queueIndex: number,
  tracks: PlayerTrack[],
  position: 'next' | 'end',
): { queue: PlayerTrack[]; inserted: number } {
  const existing = new Set(queue.map((t) => t.id));
  const incoming = dedupeQueue(tracks).filter((t) => !existing.has(t.id));
  if (incoming.length === 0) return { queue, inserted: 0 };
  const at = position === 'next' ? Math.min(queueIndex + 1, queue.length) : queue.length;
  return { queue: [...queue.slice(0, at), ...incoming, ...queue.slice(at)], inserted: incoming.length };
}
```

- [ ] **Step 4: Тесты PASS**

- [ ] **Step 5: `controls.enqueue` в `audio-engine.ts`** (импортировать `insertIntoQueue`)

```ts
/** Вставка в живую очередь; при пустом плеере ведёт себя как playQueue. */
enqueue(tracks: PlayerTrack[], position: 'next' | 'end', context: PlayContext): number {
  const s = usePlayerStore.getState();
  if (!s.track || s.queue.length === 0) {
    controls.playQueue(tracks, { context });
    return dedupeQueue(tracks).length;
  }
  const { queue, inserted } = insertIntoQueue(s.queue, s.queueIndex, tracks, position);
  if (inserted === 0) return 0;
  const patch: { queue: PlayerTrack[]; originalQueue?: PlayerTrack[] | null } = { queue };
  if (s.shuffle && s.originalQueue) {
    const origIndex = s.originalQueue.findIndex((t) => t.id === s.track!.id);
    patch.originalQueue = insertIntoQueue(
      s.originalQueue,
      origIndex >= 0 ? origIndex : s.originalQueue.length - 1,
      tracks,
      position,
    ).queue;
  }
  usePlayerStore.getState()._setState(patch);
  return inserted;
},
```

- [ ] **Step 6: Компонент `track-queue-menu.tsx`**

Паттерн поповера — как в `track-share.tsx` (useState open, pointerdown-outside + Escape закрывают, AnimatePresence, `absolute z-50 bottom-full mb-2 …`). Полный каркас:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

type Loader = () => Promise<PlayerTrack[] | null> | PlayerTrack[];

export async function enqueueWithToast(load: Loader, position: 'next' | 'end', context: PlayContext): Promise<void> {
  const tracks = await load();
  if (!tracks || tracks.length === 0) {
    toast.error('Не удалось загрузить треки');
    return;
  }
  const inserted = controls.enqueue(tracks, position, context);
  if (inserted === 0) toast('Уже в очереди');
  else toast(position === 'next' ? 'Будет следующим' : 'В очереди');
}

export function TrackQueueMenu({ getTracks, context, size = 'sm' }: {
  getTracks: Loader;
  context: PlayContext;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(position: 'next' | 'end') {
    setOpen(false);
    void enqueueWithToast(getTracks, position, context);
  }

  const dim = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  return (
    <div ref={ref} className="relative shrink-0">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Действия с очередью"
        aria-expanded={open}
        whileTap={{ scale: 0.9 }}
        transition={spring.snappy}
        className={`${dim} rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer`}
      >
        <Icon name="more" size={16} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={spring.snappy}
            className="absolute z-50 bottom-full mb-2 right-0 min-w-[184px] rounded-xl border border-white/12 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-1"
          >
            <MenuItem label="Играть следующим" icon="corner-down-right" onClick={() => pick('next')} />
            <MenuItem label="Добавить в очередь" icon="list-plus" onClick={() => pick('end')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

`MenuItem` — кнопка `role="menuitem"` в стилистике `ShareOption` из `track-share.tsx` (посмотреть и повторить классы). Иконки: проверить наличие имён в `components/icon.tsx` (`more`/`ellipsis`, `corner-down-right`, `list-plus`) — использовать существующие или добавить SVG-пути в каталог иконок тем же стилем.

- [ ] **Step 7: Вписать меню в строки главной** (`track-list.tsx`, компонент `Row`)

В `trailing` после лайка (стопер клика уже есть на обёртке лайка — меню обернуть так же):

```tsx
<span className="shrink-0" onClick={(e) => e.stopPropagation()}>
  <TrackQueueMenu getTracks={() => [queue[index]]} context={context} />
</span>
```

Меню видно всегда (не только по hover) — на таче hover-обвязки нет; счётчик прослушиваний, скрывающийся по hover, не трогать.

- [ ] **Step 8: Действия в peek-шите релиза** (`release-quick-look.tsx`)

В строку с кнопкой «Слушать» + «К релизу» добавить справа:

```tsx
<span className="ml-auto">
  <TrackQueueMenu size="md" getTracks={() => load()} context={context} />
</span>
```

(`load` из уже существующего `useLazyQueue`; `context` объявлен выше в компоненте.)

- [ ] **Step 9: Гейты** `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test && pnpm --filter @vire/web lint`

- [ ] **Step 10: Ручная верификация** (dev-сервер): с главной запустить трек, у другого трека меню → «Играть следующим» → следующий трек — он; «Добавить в очередь» → в конце панели «Дальше»; повтор → тост «Уже в очереди»; при пустом плеере меню запускает воспроизведение. Проверить в шаффле и в волне.

- [ ] **Step 11: Commit** `feat(player): «Играть следующим» и «В очередь» с карточек главной`

---

### Task 4: Ревизия чипов «Потока» — один ряд, кап 8

**Files:**
- Modify: `apps/web/components/home/wave-chip-items.ts` (+`topWaveChips`, убрать `moodChipItems`/`genreChipItems`)
- Test: `apps/web/components/home/wave-chip-items.test.ts` (новый)
- Modify: `apps/web/components/home/flow-block.tsx` (один ряд без подписей)
- Modify: `apps/web/components/home/wave-chips.tsx` (удалить неиспользуемый `WaveChipRow`)

**Interfaces:**
- Produces: `topWaveChips(moods: MoodChip[], genres: GenreCount[], cap = 8): WaveChipItem[]`
- `WaveChips` (существующий) продолжает принимать `items: WaveChipItem[]` — не меняется.

- [ ] **Step 1: Падающий тест**

```ts
import { describe, expect, it } from 'vitest';
import { topWaveChips } from './wave-chip-items';
import type { Mood } from '@/lib/moods';
import type { TrackGenre } from '@/lib/genres';

const m = (mood: Mood, count: number) => ({ mood, count });
const g = (genre: TrackGenre, count: number) => ({ genre, count });

describe('topWaveChips', () => {
  it('смешивает mood и genre по убыванию count и режет до cap', () => {
    const chips = topWaveChips(
      [m('CALM', 10), m('ENERGETIC', 3)],
      [g('HIP_HOP', 7), g('ROCK', 5), g('ELECTRONIC', 1)],
      3,
    );
    expect(chips.map((c) => c.key)).toEqual(['CALM', 'HIP_HOP', 'ROCK']);
  });

  it('дефолтный cap = 8', () => {
    const moods = (['CALM', 'ENERGETIC', 'SAD', 'HAPPY', 'DARK'] as Mood[]).map((x, i) => m(x, 100 - i));
    const genres = (['HIP_HOP', 'ROCK', 'ELECTRONIC', 'POP', 'JAZZ'] as TrackGenre[]).map((x, i) => g(x, 50 - i));
    expect(topWaveChips(moods, genres)).toHaveLength(8);
  });

  it('kind сохраняется для сида волны', () => {
    const chips = topWaveChips([m('CALM', 1)], [g('ROCK', 2)], 8);
    expect(chips.find((c) => c.key === 'ROCK')?.kind).toBe('genre');
    expect(chips.find((c) => c.key === 'CALM')?.kind).toBe('mood');
  });
});
```

(Точные литералы Mood/TrackGenre взять из `lib/moods.ts` / `lib/genres.ts` — если приведённых нет, заменить на существующие.)

- [ ] **Step 2: Прогнать — FAIL**

- [ ] **Step 3: Реализация `topWaveChips`** (в `wave-chip-items.ts`; старые `moodChipItems`/`genreChipItems` удалить)

```ts
/** Топ-N чипов волны: mood и genre вперемешку по популярности — один ряд вместо двух. */
export function topWaveChips(moods: MoodChip[], genres: GenreCount[], cap = 8): WaveChipItem[] {
  const all: { item: WaveChipItem; count: number }[] = [
    ...moods.map(({ mood, count }) => ({ item: { key: mood, label: MOOD_LABELS[mood], kind: 'mood' as const }, count })),
    ...genres.map(({ genre, count }) => ({ item: { key: genre, label: GENRE_LABELS[genre], kind: 'genre' as const }, count })),
  ];
  all.sort((a, b) => b.count - a.count || a.item.label.localeCompare(b.item.label, 'ru'));
  return all.slice(0, cap).map((e) => e.item);
}
```

- [ ] **Step 4: FlowBlock — один ряд**

```tsx
import type { GenreCount } from '@vire/db';
import { WaveStartButton } from '@/components/wave-start-button';
import { WaveChips } from '@/components/home/wave-chips';
import { type MoodChip, topWaveChips } from '@/components/home/wave-chip-items';

export function FlowBlock({ moods, genres }: { moods: MoodChip[]; genres: GenreCount[] }) {
  const chips = topWaveChips(moods, genres);
  return (
    <section aria-label="Поток" className="rounded-2xl bg-foreground/[0.03] ring-1 ring-border p-5 sm:p-6 space-y-4">
      <WaveStartButton />
      {chips.length > 0 && <WaveChips items={chips} />}
    </section>
  );
}
```

Из `wave-chips.tsx` удалить `WaveChipRow` (единственный потребитель — старый FlowBlock).

- [ ] **Step 5: Тесты PASS + `pnpm --filter @vire/web typecheck`**

- [ ] **Step 6: Визуальная проверка** (dev): панель «Поток» — CTA + один ряд ≤8 чипов, активный чип подсвечивается, скролл-край `ScrollRow` работает.

- [ ] **Step 7: Commit** `feat(home): чипы «Потока» — один смешанный ряд топ-8 вместо двух полных`

---

### Task 5: Стриминг главной со скелетонами

**Files:**
- Create: `apps/web/app/(listener)/home-sections.tsx` (async-секции + общие cache()-фетчеры)
- Create: `apps/web/components/home/skeletons.tsx` (статичные плейсхолдеры)
- Modify: `apps/web/app/(listener)/page.tsx` (блокирующая часть + Suspense-обвязка)

**Interfaces:**
- Produces (в `home-sections.tsx`): async server-компоненты `PersonalBlock({ userId })`, `FeedSection({ userId })`, `HotTracksSection()`, `FreshReleasesSection()`, `UpcomingSection()`, `ListeningNowSection()`, `PlaylistsSection({ userId })`, `ArtistsSection()`, `CatalogEmptyNotice()`; `cachedLatestReleases = cache(...)`.
- Produces (в `skeletons.tsx`): `RailSkeleton({ title, cardWidth, count, href, hrefLabel })`, `TrackListSkeleton({ title, rows })`.

- [ ] **Step 1: Скелетоны** (`components/home/skeletons.tsx`, server-компонент, БЕЗ анимаций)

```tsx
import { Section } from '@/components/listener/section';

function CoverCard({ width }: { width: string }) {
  return (
    <div className={`shrink-0 ${width} space-y-2.5`} aria-hidden="true">
      <div className="aspect-square rounded-md bg-foreground/[0.04]" />
      <div className="h-3.5 w-3/4 rounded bg-foreground/[0.04]" />
      <div className="h-3 w-1/2 rounded bg-foreground/[0.04]" />
    </div>
  );
}

export function RailSkeleton({ title, cardWidth, count = 8, href, hrefLabel }: {
  title: string;
  cardWidth: string;
  count?: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <Section title={title} href={href} hrefLabel={hrefLabel}>
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: count }, (_, i) => <CoverCard key={i} width={cardWidth} />)}
      </div>
    </Section>
  );
}

export function TrackListSkeleton({ title, rows = 8, href, hrefLabel }: {
  title: string;
  rows?: number;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <Section title={title} href={href} hrefLabel={hrefLabel}>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/60" aria-hidden="true">
            <div className="w-9 h-9 shrink-0 rounded-sm bg-foreground/[0.04]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-2/5 rounded bg-foreground/[0.04]" />
              <div className="h-3 w-1/4 rounded bg-foreground/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Секции** (`app/(listener)/home-sections.tsx`)

Перенести из `page.tsx` фетчи и JSX секций 1-в-1 (те же `.catch(() => [])`, та же разметка, те же `ScrollRow`-параметры). Общие данные — через React `cache()`:

```tsx
import { cache } from 'react';
import { getLatestReleases, getUpcomingReleases, listActiveArtists /* … */ } from '@vire/db';

export const cachedLatestReleases = cache(() => getLatestReleases(19).catch(() => []));
const cachedUpcoming = cache(() => getUpcomingReleases(8).catch(() => []));
const cachedArtists = cache(() => listActiveArtists().catch(() => []));
```

- `PersonalBlock({ userId })`: `getRecentlyPlayed` + `getPersonalTrackPicks` параллельно (`Promise.all`), дедуп `personalPicksDeduped` как сейчас, рендерит `RecentRail` + секцию «Для тебя» (условие `>= 4` сохранить).
- `FeedSection({ userId })`: `getFeed`, секция «Новое у подписок».
- `HotTracksSection()`: `getPopularTracks(30, 20)` → `<HotTracks/>`.
- `FreshReleasesSection()`: `listReleases({ sort: 'fresh', … })` + `cachedLatestReleases()`, логика `featured?.id`/`weekFresh`/`rest` как в текущем `page.tsx` (featured = `latest[0]`).
- `UpcomingSection()`: `cachedUpcoming()`.
- `ListeningNowSection()`: `getListeningNow(6)` → `<ListeningNow initial={…}/>`.
- `PlaylistsSection({ userId })`: shared/personal/fill/public/liked — весь текущий блок сборки `allPlaylists`.
- `ArtistsSection()`: `cachedArtists()`.
- `CatalogEmptyNotice()`: `cachedLatestReleases()` + `cachedUpcoming()` + `cachedArtists()` — если все пусты, рендерит текущий `<p>Пока пусто…</p>`, иначе `null`.

- [ ] **Step 3: Переписать `page.tsx`**

Блокирующая часть: `auth()`, `cachedLatestReleases()` (hero + `getReleaseCardStats`), `getMoodCounts`/`getGenreCounts` (FlowBlock). Дальше — секции в исходном порядке:

```tsx
<main className="w-full max-w-[120rem] mx-auto px-5 sm:px-6 lg:px-8 py-12 space-y-16">
  <JsonLd data={websiteJsonLd()} />
  <h1 className="sr-only">…(как было)…</h1>
  {featured && <FeaturedRelease release={featured} stats={featuredStats} />}
  <FlowBlock moods={moodCounts} genres={genreCounts} />

  {userId && (
    <Suspense fallback={null}>
      <PersonalBlock userId={userId} />
    </Suspense>
  )}
  {userId && (
    <Suspense fallback={null}>
      <FeedSection userId={userId} />
    </Suspense>
  )}
  <Suspense fallback={<TrackListSkeleton title="Горячие треки" href="/releases" hrefLabel="Весь каталог" />}>
    <HotTracksSection />
  </Suspense>
  <Suspense fallback={<RailSkeleton title="Свежие релизы" cardWidth="w-48" href="/releases" hrefLabel="Посмотреть все" />}>
    <FreshReleasesSection />
  </Suspense>
  <Suspense fallback={null}>
    <UpcomingSection />
  </Suspense>
  <Suspense fallback={null}>
    <ListeningNowSection />
  </Suspense>
  <Suspense fallback={<RailSkeleton title="Подборки" cardWidth="w-40" />}>
    <PlaylistsSection userId={userId} />
  </Suspense>
  <Suspense fallback={<RailSkeleton title="Артисты" cardWidth="w-28" href="/artists" hrefLabel="Все артисты" />}>
    <ArtistsSection />
  </Suspense>
  <Suspense fallback={null}>
    <CatalogEmptyNotice />
  </Suspense>
</main>
```

Нюансы:
- Скелетон «Артисты»: посмотреть `artist-hover-chip.tsx` — если аватар круглый, в `RailSkeleton` для этого случая нужен вариант `rounded-full` (проп `round?: boolean` на `CoverCard`).
- Скелетоны секций, которые по данным окажутся пустыми (`rest.length === 0`, `allPlaylists.length === 0`), исчезнут в ничто — на живом каталоге секции непустые, принятый компромисс (зафиксирован в спеке).
- Никаких `min-h-screen`; `main`-классы не менять.

- [ ] **Step 4: Гейты** `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test && pnpm --filter @vire/web lint`

- [ ] **Step 5: Ручная верификация** (dev, вкл. троттлинг сети в devtools): главная отдаёт hero+Поток сразу, ниже — скелетоны, замена без сдвига (следить за подпрыгиванием при догрузке); анонимно и под логином; мобильный вьюпорт.

- [ ] **Step 6: Commit** `feat(home): стриминг секций главной со статичными скелетонами`

---

## Финал пачки (после всех задач)

1. Полные гейты: typecheck (web+core+db) / lint / check:routes / test / audit:design / build.
2. Playwright CDP LayerTree — в скролл-области главной 0 композит-слоёв (анти-джиттер).
3. Отметить 5 пунктов в `docs/roadmap/TODO.md` (блок «Отложенное из критики главной»).
4. Обновить `docs/features/`: player.md (enqueue), curated-playlists.md или listener-shell.md (стриминг/чипы/CoverFan) — по месту.
5. Версия в двух местах + `pnpm install` + коммит lockfile + тег — по команде на деплой (тег без команды не пушить).
