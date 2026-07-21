# Мобайл-фёрст Срез 0 — Фундамент паттернов: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заложить переиспользуемые мобильные примитивы (bottom-sheet-ядро, AdaptiveMenu), тач-таргеты в UI-ките, ревизию таб-бара и тач-аффордансы — фундамент, поверх которого срезы 1–6 раскатывают мобильный UX без дублей.

**Architecture:** Презентационный слой `apps/web/components` + `packages/ui`. Выделяем `Sheet`-ядро из существующего `QuickLookSheet` (портал/drag-dismiss/esc/safe-area уже есть), добавляем `anchor="bottom"`. Строим `AdaptiveMenu` — по `useIsDesktopPointer()` рендерит `Popover` (десктоп) или `Sheet` со списком (тач). Тач-таргеты — `pointer-coarse:`-вариант в cva UI-кита (десктоп-плотность не меняется). Навигация/аффордансы — точечные правки.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4 (конфиг в CSS, `pointer-fine`/`pointer-coarse` встроенные варианты), motion/react, Vitest + testing-library (jsdom через `// @vitest-environment jsdom`).

## Global Constraints

- **App-shell неизменен:** `min-h-screen`/`h-screen` на страницах/лейаутах ЗАПРЕЩЕНЫ. Высоту даёт единственная скролл-область. Инвариант защищён `app/__tests__/layout-shell.test.ts` — держать зелёным.
- **Комментарии** — почти никогда: только неочевидное «почему» в 1–2 строки. Никаких эссе/нарратива правок.
- **Раздел desktop/mobile** — брейкпоинт `md` (768px). Тач/десктоп-указатель — `pointer-coarse`/`pointer-fine` (медиа), не userAgent.
- **Тач-таргет** — 44px (`h-11`/`size-11`/`min-h-11`).
- **Гейты (все, финал):** `pnpm --filter @vire/web typecheck`, `pnpm --filter @vire/core typecheck`, `pnpm --filter @vire/db typecheck`, `pnpm --filter @vire/web lint`, `pnpm --filter @vire/web check:routes`, `pnpm --filter @vire/web test`, `pnpm --filter @vire/web audit:design`, `pnpm --filter @vire/web build`.
- **Ветка:** `feat/mobile-first` (уже создана). Не пушить/тегать без явной команды.

---

## File Structure

- `apps/web/components/sheet.tsx` — **Create.** Ядро шторки (портал, backdrop, drag-dismiss, esc, safe-area, offset под плеер), проп `anchor: 'center' | 'bottom'`. Экспорт: `Sheet`, `SheetDragHandle`.
- `apps/web/components/quick-look-sheet.tsx` — **Modify.** Становится тонкой обёрткой `Sheet anchor="center"`; реэкспорт `QuickLookDragHandle`/`MiniEq` — потребители не меняются.
- `apps/web/components/adaptive-menu.tsx` — **Create.** `AdaptiveMenu` поверх `useIsDesktopPointer()`: Popover (десктоп) / Sheet-список (тач). Тип `MenuItem`.
- `apps/web/components/track-queue-menu.tsx` — **Modify.** Перевод с `Popover` на `AdaptiveMenu` (живая проверка примитива).
- `packages/ui/src/components/button.tsx` — **Modify.** `pointer-coarse:`-минимум в cva-размеры.
- `packages/ui/src/components/input.tsx` — **Modify.** `pointer-coarse:h-11`.
- `apps/web/components/add-to-playlist-button.tsx` — **Modify.** Тач-хит-зона триггера 32→44.
- `apps/web/components/listener/mobile-tab-bar.tsx` — **Modify.** 5 пунктов (+Друзья), бейдж заявок переезжает на `/friends`.
- `apps/web/components/scroll-row.tsx` — **Modify.** Краевая fade-маска на `pointer-coarse`.
- `apps/web/components/nav.tsx` — **Modify.** SignOut скрыть из топ-бара на мобилке (дублируется в `/profile`).
- `docs/features/mobile-patterns.md` — **Create.** Единый источник паттернов для срезов 1–6.
- Tests: `sheet.test.tsx`, `adaptive-menu.test.tsx`, `mobile-tab-bar.test.tsx` (все в `components/`, jsdom).

**Порядок и параллельность реализации:** Task 1 → Task 2 (зависит от Sheet). Tasks 3, 4, 5, 6 независимы (разные файлы) — параллелятся между собой и с 1/2. Task 7 (доки) — последним, документирует итог.

---

### Task 1: `Sheet`-ядро + рефактор `QuickLookSheet`

**Files:**
- Create: `apps/web/components/sheet.tsx`
- Modify: `apps/web/components/quick-look-sheet.tsx`
- Test: `apps/web/components/sheet.test.tsx`

**Interfaces:**
- Consumes: `usePlayerStore` (`@/store/player`), `spring` (`@vire/ui/motion`), `cn` (`@/lib/utils`).
- Produces:
  - `Sheet({ open: boolean, onClose: () => void, anchor?: 'center' | 'bottom', panelClassName?: string, children: ReactNode })`
  - `SheetDragHandle({ children: ReactNode, className?: string })` — стартует свайп-закрытие с шапки контента.

- [ ] **Step 1: Написать падающий тест**

Create `apps/web/components/sheet.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/store/player', () => ({ usePlayerStore: (sel: (s: unknown) => unknown) => sel({ track: null }) }));

import { Sheet } from './sheet';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Sheet', () => {
  it('не рендерит содержимое, когда закрыт', () => {
    render(<Sheet open={false} onClose={() => {}}><p>содержимое</p></Sheet>);
    expect(screen.queryByText('содержимое')).toBeNull();
  });

  it('рендерит содержимое порталом в body, когда открыт', () => {
    render(<Sheet open onClose={() => {}}><p>содержимое</p></Sheet>);
    const node = screen.getByText('содержимое');
    expect(node).not.toBeNull();
    expect(document.body.contains(node)).toBe(true);
  });

  it('вызывает onClose по Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose}><p>содержимое</p></Sheet>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('anchor="bottom" даёт прилипшую к низу геометрию (rounded-t)', () => {
    render(<Sheet open onClose={() => {}} anchor="bottom"><p data-testid="c">c</p></Sheet>);
    const panel = screen.getByTestId('c').closest('.rounded-t-2xl');
    expect(panel).not.toBeNull();
  });
});
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `pnpm --filter @vire/web test -- sheet.test`
Expected: FAIL — `Cannot find module './sheet'`.

- [ ] **Step 3: Реализовать `Sheet`**

Create `apps/web/components/sheet.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type DragControls, type PanInfo } from 'motion/react';
import { spring } from '@vire/ui/motion';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/player';

// drag стартует только с граббера/шапки: drag="y" на всей шторке ставит touch-action:none
// и убивает тач-скролл внутреннего контента
const DragHandleContext = createContext<DragControls | null>(null);

interface SheetProps {
  open: boolean;
  onClose: () => void;
  anchor?: 'center' | 'bottom';
  panelClassName?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, anchor = 'center', panelClassName, children }: SheetProps) {
  const activeTrack = usePlayerStore((s) => s.track);
  const dragControls = useDragControls();

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  }

  const isBottom = anchor === 'bottom';

  // портал в body: без него fixed ловит трансформированного предка (Stagger-карточки)
  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClose}
          className={cn(
            'fixed inset-0 z-[60] flex bg-black/80 backdrop-blur-xl',
            isBottom ? 'items-end justify-center' : 'items-center justify-center p-4 sm:p-6',
          )}
          style={{ paddingBottom: !isBottom && activeTrack ? 'calc(64px + 1.5rem)' : undefined }}
        >
          <motion.div
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            onClick={(e) => e.stopPropagation()}
            initial={isBottom ? { y: '100%' } : false}
            animate={isBottom ? { y: 0 } : undefined}
            exit={isBottom ? { y: '100%' } : undefined}
            transition={spring.smooth}
            className={cn(
              'flex flex-col bg-card border-border shadow-2xl overflow-hidden cursor-default',
              isBottom
                ? 'w-full max-w-xl max-h-[85vh] rounded-t-2xl border-t border-x pb-[env(safe-area-inset-bottom)]'
                : 'w-full max-w-md max-h-full rounded-2xl border',
              panelClassName,
            )}
          >
            <DragHandleContext.Provider value={dragControls}>
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="pt-2.5 pb-1 flex justify-center touch-none cursor-grab active:cursor-grabbing shrink-0"
              >
                <span className="w-10 h-1 rounded-full bg-white/15" />
              </div>
              {children}
            </DragHandleContext.Provider>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}

export function SheetDragHandle({ children, className }: { children: React.ReactNode; className?: string }) {
  const dragControls = useContext(DragHandleContext);
  return (
    <div onPointerDown={(e) => dragControls?.start(e)} className={`touch-none${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Прогнать — убедиться, что проходит**

Run: `pnpm --filter @vire/web test -- sheet.test`
Expected: PASS (4 теста).

- [ ] **Step 5: Рефактор `QuickLookSheet` в обёртку над `Sheet`**

Заменить содержимое `apps/web/components/quick-look-sheet.tsx` на (сохраняет публичные экспорты `QuickLookSheet`, `QuickLookDragHandle`, `MiniEq` — потребители `release-quick-look`/`playlist-quick-look`/`all-tags-sheet` не трогаются):

```tsx
'use client';

import { Sheet, SheetDragHandle } from '@/components/sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function QuickLookSheet({ open, onClose, children }: Props) {
  return (
    <Sheet open={open} onClose={onClose} anchor="center">
      {children}
    </Sheet>
  );
}

/** Шапка peek-контента тоже стартует свайп-закрытие — чтобы не целиться в узкий граббер. */
export const QuickLookDragHandle = SheetDragHandle;

export function MiniEq({ animate }: { animate: boolean }) {
  return (
    <span
      className="inline-flex items-end gap-[1.5px] h-3"
      style={{ color: 'var(--artist-accent, hsl(200 80% 65%))' }}
      aria-label="Сейчас играет"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] bg-current rounded-full"
          style={{
            height: animate ? undefined : '35%',
            animation: animate ? `vire-eq 0.9s ease-in-out ${i * 0.15}s infinite` : undefined,
          }}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 6: Прогнать весь тест-набор — регресс потребителей `QuickLookSheet`**

Run: `pnpm --filter @vire/web test`
Expected: PASS (весь набор; потребители quick-look не сломаны).

- [ ] **Step 7: typecheck**

Run: `pnpm --filter @vire/web typecheck`
Expected: без ошибок.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/sheet.tsx apps/web/components/sheet.test.tsx apps/web/components/quick-look-sheet.tsx
git commit -m "feat(mobile): Sheet-ядро (anchor bottom/center), QuickLookSheet → обёртка"
```

---

### Task 2: `AdaptiveMenu` + перевод `track-queue-menu`

**Files:**
- Create: `apps/web/components/adaptive-menu.tsx`
- Modify: `apps/web/components/track-queue-menu.tsx`
- Test: `apps/web/components/adaptive-menu.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (Task 1), `Popover`/`PopoverItem`/`PopoverTriggerProps` (`@/components/popover`), `useIsDesktopPointer` (`@/lib/is-desktop-pointer`).
- Produces:
  - `MenuItem = { label: string; icon?: ReactNode; hint?: ReactNode; onClick: () => void; disabled?: boolean }`
  - `AdaptiveMenu({ open, onOpenChange, items: MenuItem[], trigger: (p: PopoverTriggerProps) => ReactNode, title?: string, align?: 'left'|'right', drop?: 'up'|'down'|'auto' })`

- [ ] **Step 1: Написать падающий тест**

Create `apps/web/components/adaptive-menu.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const desktop = { value: true };
vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => desktop.value }));
vi.mock('@/store/player', () => ({ usePlayerStore: (sel: (s: unknown) => unknown) => sel({ track: null }) }));

import { AdaptiveMenu, type MenuItem } from './adaptive-menu';

function setup(items: MenuItem[]) {
  return render(
    <AdaptiveMenu
      open
      onOpenChange={() => {}}
      items={items}
      trigger={({ toggle, ref }) => (
        <button ref={ref} onClick={toggle}>триггер</button>
      )}
    />,
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); desktop.value = true; });

describe('AdaptiveMenu', () => {
  it('на десктопе рендерит пункты в поповер-меню (role=menu)', () => {
    setup([{ label: 'Действие A', onClick: () => {} }]);
    expect(screen.getByRole('menu')).not.toBeNull();
    expect(screen.getByText('Действие A')).not.toBeNull();
  });

  it('клик по пункту вызывает его onClick', () => {
    const onClick = vi.fn();
    setup([{ label: 'Действие A', onClick }]);
    fireEvent.click(screen.getByText('Действие A'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('на таче рендерит пункты в bottom-sheet (портал в body, без role=menu)', () => {
    desktop.value = false;
    setup([{ label: 'Действие B', onClick: () => {} }]);
    const node = screen.getByText('Действие B');
    expect(document.body.contains(node)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `pnpm --filter @vire/web test -- adaptive-menu.test`
Expected: FAIL — `Cannot find module './adaptive-menu'`.

- [ ] **Step 3: Реализовать `AdaptiveMenu`**

Create `apps/web/components/adaptive-menu.tsx`:

```tsx
'use client';

import { useRef, type ReactNode } from 'react';
import { useIsDesktopPointer } from '@/lib/is-desktop-pointer';
import { Popover, PopoverItem, type PopoverTriggerProps } from '@/components/popover';
import { Sheet } from '@/components/sheet';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface AdaptiveMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
  trigger: (props: PopoverTriggerProps) => ReactNode;
  title?: string;
  align?: 'left' | 'right';
  drop?: 'up' | 'down' | 'auto';
}

export function AdaptiveMenu({ open, onOpenChange, items, trigger, title, align, drop }: AdaptiveMenuProps) {
  const desktop = useIsDesktopPointer();
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange} trigger={trigger} align={align} drop={drop}>
        {items.map((it, i) => (
          <PopoverItem
            key={i}
            label={it.label}
            icon={it.icon}
            hint={it.hint}
            disabled={it.disabled}
            onClick={it.onClick}
          />
        ))}
      </Popover>
    );
  }

  return (
    <div className="relative shrink-0">
      {trigger({ open, toggle: () => onOpenChange(!open), ref: triggerRef })}
      <Sheet open={open} onClose={() => onOpenChange(false)} anchor="bottom">
        {title && (
          <p className="px-4 pt-1 pb-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
        )}
        <div className="pb-2">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { onOpenChange(false); it.onClick(); }}
              className="w-full min-h-11 flex items-center gap-3 px-4 text-left text-[15px] text-foreground/90 hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {it.icon && <span className="w-5 shrink-0 flex items-center justify-center text-foreground/40">{it.icon}</span>}
              <span className="flex-1">{it.label}</span>
              {it.hint}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 4: Прогнать — убедиться, что проходит**

Run: `pnpm --filter @vire/web test -- adaptive-menu.test`
Expected: PASS (3 теста).

- [ ] **Step 5: Перевести `track-queue-menu` на `AdaptiveMenu`**

Заменить `apps/web/components/track-queue-menu.tsx` (сохраняет `enqueueWithToast` и сигнатуру `TrackQueueMenu`):

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { spring } from '@vire/ui/motion';
import type { PlayerTrack, PlayContext } from '@/store/player';
import { controls } from '@/lib/player/audio-engine';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';
import { touchTargetClass } from '@/components/popover';
import { AdaptiveMenu } from '@/components/adaptive-menu';

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

export function TrackQueueMenu({ getTracks, context, size = 'sm', drop = 'auto' }: {
  getTracks: Loader;
  context: PlayContext;
  size?: 'sm' | 'md';
  /** 'down' — внутри overflow-hidden контейнеров (peek-шит), где раскрытие вверх клипается. */
  drop?: 'auto' | 'down';
}) {
  const [open, setOpen] = useState(false);

  function pick(position: 'next' | 'end') {
    void enqueueWithToast(getTracks, position, context);
  }

  return (
    <AdaptiveMenu
      open={open}
      onOpenChange={setOpen}
      drop={drop}
      title="Очередь"
      items={[
        { label: 'Играть следующим', icon: <Icon name="corner-down-right" size={14} />, onClick: () => pick('next') },
        { label: 'Добавить в очередь', icon: <Icon name="list-plus" size={14} />, onClick: () => pick('end') },
      ]}
      trigger={({ open: expanded, toggle, ref }) => (
        <motion.button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-label="Действия с очередью"
          aria-expanded={expanded}
          whileTap={{ scale: 0.9 }}
          transition={spring.snappy}
          className={`${touchTargetClass(size)} rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer`}
        >
          <Icon name="more-vertical" size={16} />
        </motion.button>
      )}
    />
  );
}
```

> Примечание: `AdaptiveMenu` сам закрывает меню перед `onClick` на тач-ветке; на десктоп-ветке `PopoverItem.onClick` вызывается напрямую — поэтому `pick` больше не зовёт `setOpen(false)` (десктопный Popover закрывается по outside-click/Escape; для мгновенного закрытия на клик это приемлемо, поведение как в остальных `PopoverItem`-меню). Если потребуется закрытие на десктопе — обернуть `onClick` в `() => { setOpen(false); pick(...) }`.

- [ ] **Step 6: Прогнать весь тест-набор + typecheck**

Run: `pnpm --filter @vire/web test`
Run: `pnpm --filter @vire/web typecheck`
Expected: PASS / без ошибок.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/adaptive-menu.tsx apps/web/components/adaptive-menu.test.tsx apps/web/components/track-queue-menu.tsx
git commit -m "feat(mobile): AdaptiveMenu (sheet на таче / popover на десктопе), track-queue-menu переведён"
```

---

### Task 3: Тач-таргеты в UI-ките (`pointer-coarse`)

**Files:**
- Modify: `packages/ui/src/components/button.tsx:23-28`
- Modify: `packages/ui/src/components/input.tsx:11`
- Modify: `apps/web/components/add-to-playlist-button.tsx:127-133`

**Interfaces:**
- Consumes: —
- Produces: контролы UI-кита получают минимум 44px при `pointer: coarse`; десктоп-плотность не меняется.

- [ ] **Step 1: `button.tsx` — pointer-coarse в cva-размеры**

Заменить блок `size` (строки 23-28) на:

```tsx
      size: {
        sm: 'h-8 px-3 text-xs pointer-coarse:h-11',
        default: 'h-9 px-4 py-2 pointer-coarse:h-11',
        lg: 'h-10 px-8 pointer-coarse:h-11',
        icon: 'h-9 w-9 pointer-coarse:size-11',
      },
```

- [ ] **Step 2: `input.tsx` — pointer-coarse высота**

В `input.tsx` строке 11 заменить `'flex h-9 w-full ...'` — добавить `pointer-coarse:h-11` сразу после `h-9`:

```tsx
        'flex h-9 pointer-coarse:h-11 w-full rounded-md bg-secondary px-3 py-1 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
```

- [ ] **Step 3: `add-to-playlist-button.tsx` — тач-таргет триггера**

В триггер-кнопке (строки 127-133) заменить `'w-8 h-8 rounded-full ...'` — добавить `pointer-coarse:size-11`:

```tsx
        className={cn(
          'w-8 h-8 pointer-coarse:size-11 rounded-full flex items-center justify-center transition-opacity',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'artist'
            ? 'border border-[color-mix(in_oklch,var(--artist-accent)_35%,transparent)] opacity-50 hover:opacity-80'
            : 'border border-border opacity-50 hover:opacity-80',
        )}
```

- [ ] **Step 4: typecheck обоих пакетов**

Run: `pnpm --filter @vire/ui typecheck` (если есть скрипт; иначе `pnpm --filter @vire/web typecheck` подхватит через сборку)
Run: `pnpm --filter @vire/web typecheck`
Expected: без ошибок.

- [ ] **Step 5: audit:design (тач-таргеты — часть дизайн-гейта)**

Run: `pnpm --filter @vire/web audit:design`
Expected: без новых нарушений (число замечаний не выросло относительно базового прогона).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/button.tsx packages/ui/src/components/input.tsx apps/web/components/add-to-playlist-button.tsx
git commit -m "feat(mobile): тач-таргеты 44px через pointer-coarse в UI-ките (десктоп-плотность не тронута)"
```

---

### Task 4: Таб-бар — 5 пунктов (+Друзья), перевес бейджа заявок

**Files:**
- Modify: `apps/web/components/listener/mobile-tab-bar.tsx`
- Test: `apps/web/components/listener/mobile-tab-bar.test.tsx`

**Interfaces:**
- Consumes: `useChatUnread`, `isListenerShellPath`, `Icon` (`users` из манифеста — подтверждено наличие).
- Produces: `MobileTabBar` с 5 пунктами; бейдж `incomingCount` на `/friends`, `messagesUnread` на `/messages`.

- [ ] **Step 1: Проверить, что `/friends` — listener-роут (таб-бар на нём не скрывается)**

Run: `grep -n "friends\|startsWith\|const LISTENER" apps/web/lib/listener-shell.ts`
Expected: `/friends` попадает под `isListenerShellPath` (совпадает по префиксу listener-путей). Если нет — добавить `/friends` в список разрешённых префиксов в `listener-shell.ts` (и это станет частью Step 4 коммита).

- [ ] **Step 2: Написать падающий тест**

Create `apps/web/components/listener/mobile-tab-bar.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/chat-unread', () => ({ useChatUnread: (n: number) => n }));

import { MobileTabBar } from './mobile-tab-bar';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MobileTabBar', () => {
  it('содержит 5 пунктов включая Друзей', () => {
    render(<MobileTabBar />);
    for (const label of ['Главная', 'Поиск', 'Медиатека', 'Друзья', 'Сообщения']) {
      expect(screen.getByText(label)).not.toBeNull();
    }
    const friends = screen.getByText('Друзья').closest('a');
    expect(friends?.getAttribute('href')).toBe('/friends');
  });

  it('бейдж входящих заявок висит на Друзьях, а не на Медиатеке', () => {
    render(<MobileTabBar incomingCount={3} />);
    const friends = screen.getByText('Друзья').closest('a');
    const library = screen.getByText('Медиатека').closest('a');
    expect(friends?.textContent).toContain('3 новых заявок в друзья');
    expect(library?.textContent).not.toContain('заявок');
  });
});
```

- [ ] **Step 3: Прогнать — убедиться, что падает**

Run: `pnpm --filter @vire/web test -- mobile-tab-bar.test`
Expected: FAIL — «Друзья» не найдено / бейдж на Медиатеке.

- [ ] **Step 4: Обновить `mobile-tab-bar.tsx`**

Заменить массив `TABS` (строки 10-15), `grid-cols-4` → `grid-cols-5` (строка 23) и логику `badgeCount`/`sr-only`:

```tsx
const TABS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/', label: 'Главная', icon: 'home', exact: true },
  { href: '/search', label: 'Поиск', icon: 'search' },
  { href: '/library', label: 'Медиатека', icon: 'music' },
  { href: '/friends', label: 'Друзья', icon: 'users' },
  { href: '/messages', label: 'Сообщения', icon: 'message-square' },
];
```

Строка 23 — `grid-cols-4` → `grid-cols-5`.

Строка 26 (`badgeCount`) — заменить `'/library'` на `'/friends'`:

```tsx
        const badgeCount = t.href === '/friends' ? incomingCount : t.href === '/messages' ? liveMessagesUnread : 0;
```

Блок `sr-only` (строки 48-52) — заменить на:

```tsx
            {showBadge && (
              <span className="sr-only">
                {t.href === '/friends' ? `${badgeCount} новых заявок в друзья` : `${badgeCount} новых сообщений`}
              </span>
            )}
```

- [ ] **Step 5: Прогнать — убедиться, что проходит**

Run: `pnpm --filter @vire/web test -- mobile-tab-bar.test`
Expected: PASS (2 теста).

- [ ] **Step 6: check:routes + typecheck**

Run: `pnpm --filter @vire/web check:routes`
Run: `pnpm --filter @vire/web typecheck`
Expected: без ошибок.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/listener/mobile-tab-bar.tsx apps/web/components/listener/mobile-tab-bar.test.tsx apps/web/lib/listener-shell.ts
git commit -m "feat(mobile): таб-бар 5 пунктов (+Друзья), бейдж заявок переехал на /friends"
```

---

### Task 5: Тач-аффорданс горизонтальных рейлов (`scroll-row`)

**Files:**
- Modify: `apps/web/components/scroll-row.tsx`

**Interfaces:**
- Consumes: существующие `overflow`/`atStart`/`atEnd` (уже вычисляются в компоненте).
- Produces: краевая fade-маска на `pointer-coarse`, видимая пока есть куда листать; на десктопе — прежние кнопки-шевроны (`pointer-fine`).

- [ ] **Step 1: Добавить fade-маски в разметку `ScrollRow`**

В `return (...)` (после `<div ref={scrollRef}>...</div>`, внутри корневого `relative isolate`-div) добавить два `<span>` рядом с кнопками. Маска — `pointer-events-none`, показывается только на `pointer-coarse` (десктоп получает кнопки, не маску). Вставить сразу ПОСЛЕ открывающего `<div className={cn('relative isolate', bleedClassName)}>`:

```tsx
      {overflow && !atStart && (
        <span
          aria-hidden
          className={cn(
            'hidden pointer-coarse:block absolute inset-y-0 left-0 w-8 z-30 pointer-events-none bg-linear-to-r to-transparent',
            edgeFrom,
          )}
        />
      )}
      {overflow && !atEnd && (
        <span
          aria-hidden
          className={cn(
            'hidden pointer-coarse:block absolute inset-y-0 right-0 w-8 z-30 pointer-events-none bg-linear-to-l to-transparent',
            edgeFrom,
          )}
        />
      )}
```

> `z-30` — под краевыми кнопками (`z-50`) и под бейджами карточек (`z-40`), чтобы маска не перекрывала explicit-бейджи в углах карточек. Маска статична (без анимаций-промоутеров слоёв) — не нарушает инвариант скролл-джиттера.

- [ ] **Step 2: typecheck + весь тест-набор (регресс существующих потребителей ScrollRow)**

Run: `pnpm --filter @vire/web typecheck`
Run: `pnpm --filter @vire/web test`
Expected: без ошибок / PASS.

- [ ] **Step 3: audit:design**

Run: `pnpm --filter @vire/web audit:design`
Expected: без новых нарушений.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/scroll-row.tsx
git commit -m "feat(mobile): тач-аффорданс краёв ScrollRow (fade-маска на pointer-coarse)"
```

---

### Task 6: Компактный топ-бар на мобилке (`nav`)

**Files:**
- Modify: `apps/web/components/nav.tsx:54`

**Interfaces:**
- Consumes: `NavSignOut`.
- Produces: на мобилке (`<sm`) кнопка выхода скрыта из топ-бара (выход остаётся в `/profile`), правый кластер не теснится на <360px.

- [ ] **Step 1: Проверить, что выход доступен в `/profile`**

Run: `grep -rn "signOut\|Выйти\|NavSignOut\|sign-out" apps/web/app/profile apps/web/components/profile* 2>/dev/null`
Expected: на странице `/profile` есть выход (кнопка/ссылка). Если нет — НЕ скрывать SignOut из nav; вместо этого пропустить Task 6 и отметить в отчёте (выход не должен пропасть с мобилки). Дальнейшие шаги — только если выход в профиле подтверждён.

- [ ] **Step 2: Скрыть `NavSignOut` из топ-бара на мобилке**

В `nav.tsx` строке 54 заменить `<NavSignOut />` на обёртку:

```tsx
              <span className="hidden sm:block"><NavSignOut /></span>
```

- [ ] **Step 3: typecheck + весь тест-набор**

Run: `pnpm --filter @vire/web typecheck`
Run: `pnpm --filter @vire/web test`
Expected: без ошибок / PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/nav.tsx
git commit -m "feat(mobile): SignOut скрыт из топ-бара на мобилке (выход остаётся в /profile)"
```

---

### Task 7: Документ паттернов `docs/features/mobile-patterns.md`

**Files:**
- Create: `docs/features/mobile-patterns.md`

**Interfaces:**
- Consumes: итог задач 1–6.
- Produces: единый источник мобильных паттернов, на который ссылаются спеки срезов 1–6.

- [ ] **Step 1: Свериться с шаблоном фич-доки**

Run: `sed -n '1,60p' docs/features/README.md`
Expected: увидеть требуемые разделы (что делает, где код, env, ограничения).

- [ ] **Step 2: Написать `docs/features/mobile-patterns.md`**

Create `docs/features/mobile-patterns.md`:

```markdown
# Мобильные паттерны (мобайл-фёрст база)

Единый свод паттернов минимального вьюпорта. Фундамент заложен в Срезе 0
(`docs/superpowers/plans/2026-07-22-mobile-slice-0-foundation.md`); срезы 1–6 раскатки
ссылаются сюда.

## Что делает

Задаёт переиспользуемые примитивы и правила для узкого вьюпорта (<768px), не меняя
десктоп: bottom-sheet-меню действий, тач-таргеты, навигацию, аффордансы прокрутки.

## Где код

- `apps/web/components/sheet.tsx` — `Sheet` (портал, drag-dismiss, esc, safe-area,
  offset под плеер), проп `anchor: 'center' | 'bottom'`. `SheetDragHandle` — свайп с шапки.
- `apps/web/components/quick-look-sheet.tsx` — обёртка `Sheet anchor="center"` (peek-карточки).
- `apps/web/components/adaptive-menu.tsx` — `AdaptiveMenu`: `Popover` на десктопе /
  `Sheet` со списком на таче (по `useIsDesktopPointer()`). Тип `MenuItem`.
- `apps/web/components/popover.tsx` — десктоп-поповер + `touchTargetClass()` (хит-зона 44px).
- `apps/web/lib/is-desktop-pointer.ts` — `(hover: hover) and (pointer: fine)`.
- `apps/web/components/listener/mobile-tab-bar.tsx` — 5 пунктов (`md:hidden`).
- `apps/web/components/scroll-row.tsx` — рейлы: кнопки на `pointer-fine`, fade-маска на `pointer-coarse`.
- `packages/ui/src/components/{button,input}.tsx` — `pointer-coarse:h-11` (44px на таче).

## Правила

- **Раздел desktop/mobile** — брейкпоинт `md` (768px). Указатель — `pointer-fine`/`pointer-coarse`
  (медиа), НЕ userAgent.
- **Меню действий:** `AdaptiveMenu` — единый примитив; sheet на таче, поповер на десктопе.
  Не заводить новые desktop-поповеры для тач-действий.
- **Тач-таргет 44px:** контролы UI-кита — через `pointer-coarse:` в cva; произвольные
  иконки-кнопки — `touchTargetClass()` (хит-зона без изменения визуала) или `min-h-11`.
- **safe-area:** нижние закреплённые элементы — `pb-[env(safe-area-inset-bottom)]`
  (таб-бар, bottom-sheet).
- **Плеер-offset:** центрированные шиты сдвигают `paddingBottom` под играющий плеер.
- **App-shell неизменен:** `min-h-screen`/`h-screen` запрещены; высоту даёт скролл-область
  (см. CLAUDE.md § «Лейаут и скролл»). Bottom-sheet — портал в body, не внутрь скролл-области.
- **Аффорданс рейлов:** горизонтальная лента с переполнением показывает fade-маску краёв
  на таче; на десктопе — кнопки-шевроны.

## Навигация

Мобильный таб-бар (5): Главная / Поиск / Медиатека / Друзья / Сообщения. Бейдж входящих
заявок — на Друзьях, непрочитанных — на Сообщениях. Джем — контекстная сессия (не раздел):
плитка в Медиатеке + запуск из плеера (раскатка), таб-бару не место.

## Ограничения

- Браузерный хром на мобилке не прячется (нет PWA/WebAPK в Яндекс Браузере) — компенсируется
  плотностью UX.
- `pointer: coarse` — про основной указатель; на гибридах контролы могут увеличиться (безопасно).

## Раскатка

Срезы 1–6 (`docs/superpowers/specs/2026-07-22-mobile-first-program.md`): трек-действия,
плеер, контентные экраны, таблицы дашборда/админки, соц/app-screen, каталоги.
```

- [ ] **Step 3: Commit**

```bash
git add docs/features/mobile-patterns.md
git commit -m "docs(mobile): свод мобильных паттернов (mobile-patterns.md) для срезов раскатки"
```

---

## Финальная верификация (после всех задач)

- [ ] **Прогнать все гейты** (Iron Law — без «готово» до вывода команд):

```bash
pnpm --filter @vire/web typecheck
pnpm --filter @vire/core typecheck
pnpm --filter @vire/db typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```

- [ ] **Самокритика** — отдельный Sonnet-сабагент, свежий контекст: прожарить диф по Vire-чеклисту и gotchas (мобилка/дубли/утечки/layout-shell/краевые случаи). Нашёл — чинить и перепрожаривать.
- [ ] **Визуальный QA** — Playwright (глобально доступен): проверить в узком вьюпорте bottom-sheet track-queue-menu (тач-эмуляция), таб-бар 5 пунктов, тач-таргеты, fade-маску рейлов; в скролл-области 0 композит-слоёв (CDP LayerTree).

## Self-Review (проведён при написании плана)

- **Spec coverage:** A (Sheet+AdaptiveMenu) → Tasks 1–2; B (тач-таргеты) → Task 3; C (таб-бар) → Task 4; D (аффорданс рейлов) → Task 5; E (компактный топ-бар) → Task 6; F (доки) → Task 7. Все секции спеки покрыты.
- **Placeholder scan:** плейсхолдеров нет; условные ветки (Step 1 задач 4/6) дают явное «если нет — сделать X».
- **Type consistency:** `MenuItem`/`AdaptiveMenu` (Task 2) совпадают с использованием в `track-queue-menu`; `Sheet`/`SheetDragHandle` (Task 1) — с реэкспортом в `quick-look-sheet` и импортом в `adaptive-menu`.
