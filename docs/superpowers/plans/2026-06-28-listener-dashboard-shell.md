# Дашборд слушателя: оболочка — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить слушательскую часть VireMusic в дашборд по модели Spotify — постоянный левый sticky-сайдбар с навигацией и медиатекой, мобильный нижний таб-бар, новая `/library`, ужатый `/profile`, переработанная главная, удалённая `/feed`, расширенный футер.

**Architecture:** Listener-страницы переезжают в route-группу `app/(listener)/` с собственным `layout.tsx` (sticky-сайдбар внутри единственного скролл-контейнера `#main-content` + футер). Глобальный верхний `Nav` сохраняется (минус центральные ссылки). Мобильный таб-бар — flow-элемент в root после плеера, скрывается на не-listener роутах через чистую функцию `isListenerShellPath`. Backend/API/БД не трогаются.

**Tech Stack:** Next.js 15 App Router, React 19 (server + client components), TypeScript strict, Tailwind v4, Vitest (env=node), переиспользование `SideNav`, `Icon`, `next/image` и существующих репозиторных функций `@vire/db`.

## Global Constraints

- App-shell: `<body h-full overflow-hidden>`, скролла документа нет; единственный скролл-контейнер — `#main-content` (root layout). Второй вертикальный скроллер НЕ вводить.
- НИГДЕ не использовать `min-h-screen` / `h-screen` (тест `app/__tests__/layout-shell.test.ts` это ловит рекурсивно по всему `app/`).
- Скролл-область не делать flex-контейнером (ломает `min-h-full` страниц).
- Минимум комментариев — только неочевидное «почему».
- Перед UI-«готово» — `audit:design` обязателен (равноправный гейт).
- Тесты только `.test.ts` (vitest env=node): чистые функции + статические проверки исходников + прямой вызов route-хендлеров. RTL/jsdom НЕТ — render-тесты компонентов не писать.
- Не-listener префиксы (без сайдбара и таб-бара): `/dashboard`, `/admin`, `/sign-in`, `/fwqa688`.
- Версия бампается в ДВУХ местах: корневой `package.json` + `apps/web/package.json` (только на Ship, отдельно).
- Гейты перед «готово»: `pnpm --filter @vire/web typecheck | lint | check:routes | test | audit:design | build`.

---

## File Structure

**Создаются:**
- `apps/web/lib/listener-shell.ts` — чистая функция `isListenerShellPath(pathname)`.
- `apps/web/lib/listener-shell.test.ts` — юнит на неё.
- `apps/web/components/listener/mobile-tab-bar.tsx` — нижний таб-бар (client).
- `apps/web/components/listener/sidebar-primary-nav.tsx` — Главная/Медиатека (client, обёртка над `SideNav`).
- `apps/web/components/listener/library-sidebar.tsx` — блок «Медиатека» в рейле (server-friendly, принимает данные пропсами).
- `apps/web/app/(listener)/layout.tsx` — оболочка сайдбара + футер.
- `apps/web/app/(listener)/library/page.tsx` — страница «Медиатека».

**Перемещаются (git mv, URL не меняются):**
- `app/page.tsx` → `app/(listener)/page.tsx`
- `app/{artists,releases,playlists,search,smartlink,profile,about,terms,privacy,feedback,design}/` → `app/(listener)/…/`
- `app/profile/{liked-track-row,playlist-card,followed-artists}.tsx` → `components/listener/`

**Модифицируются:**
- `apps/web/components/nav.tsx` — убрать центральные ссылки.
- `apps/web/app/layout.tsx` — убрать футер-обёртку из `#main-content`, добавить `<MobileTabBar/>` после `<PlayerWrapper/>`.
- `apps/web/components/player/index.tsx` — публиковать `--player-h` на `documentElement`.
- `apps/web/components/footer.tsx` — расширить колонки (+ Релизы).
- `apps/web/app/(listener)/profile/page.tsx` — ужать до аккаунта.
- `apps/web/app/(listener)/page.tsx` — переработать под Spotify Home.
- `apps/web/app/feed/page.tsx` — заменить на `redirect('/')`.
- `apps/web/app/__tests__/layout-shell.test.ts` — расширить инварианты.

---

## Task 1: Nav — убрать центральные ссылки

**Files:**
- Modify: `apps/web/components/nav.tsx:35-40`
- Test: `apps/web/components/nav.test.ts` (создать — статическая проверка)

**Interfaces:**
- Produces: `Nav` без инлайн-ссылок Артисты/Релизы/Лента; остальное (лого, поиск, Дашборд, Админка, профиль, вход/выход) без изменений.

- [ ] **Step 1: Failing test** — `apps/web/components/nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./nav.tsx', import.meta.url)), 'utf8');

describe('Nav', () => {
  it('не содержит центральных контентных ссылок (ушли в сайдбар/футер)', () => {
    expect(src).not.toMatch(/href="\/feed"/);
    expect(src).not.toMatch(/>Артисты</);
    expect(src).not.toMatch(/>Релизы</);
  });
  it('сохраняет поиск и профиль', () => {
    expect(src).toMatch(/NavSearch/);
    expect(src).toMatch(/href="\/profile"/);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm --filter @vire/web test -- nav.test` → FAIL (ссылки ещё есть).

- [ ] **Step 3: Реализация** — удалить блок в `nav.tsx`:

```tsx
        {/* Center: основная навигация */}
        <div className="hidden sm:flex items-center gap-0.5">
          <NavLink href="/artists">Артисты</NavLink>
          <NavLink href="/releases">Релизы</NavLink>
          {user && <NavLink href="/feed">Лента</NavLink>}
        </div>
```

Удалить целиком. Неиспользуемый импорт `NavLink` оставить (используется ниже для Дашборд/Админка/профиль). Если `feed`-проверка `user` больше нигде — оставить `user` (используется в правом блоке).

- [ ] **Step 4: Run, expect PASS** — `pnpm --filter @vire/web test -- nav.test`.

- [ ] **Step 5: typecheck + lint**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web lint` → без ошибок (убедиться, что не осталось мёртвых импортов).

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/nav.tsx apps/web/components/nav.test.ts
git commit -m "feat(nav): убрать центральные ссылки — навигация уезжает в сайдбар/футер"
```

---

## Task 2: Чистая функция `isListenerShellPath`

**Files:**
- Create: `apps/web/lib/listener-shell.ts`
- Test: `apps/web/lib/listener-shell.test.ts`

**Interfaces:**
- Produces: `isListenerShellPath(pathname: string): boolean` — `true` для listener-роутов (где нужны сайдбар/таб-бар), `false` для `/dashboard`, `/admin`, `/sign-in`, `/fwqa688` (и их подпутей).

- [ ] **Step 1: Failing test** — `apps/web/lib/listener-shell.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isListenerShellPath } from './listener-shell';

describe('isListenerShellPath', () => {
  it('listener-роуты → true', () => {
    for (const p of ['/', '/library', '/profile', '/artists', '/artists/foo', '/releases', '/search'])
      expect(isListenerShellPath(p)).toBe(true);
  });
  it('дашборд/админка/auth/секрет → false', () => {
    for (const p of ['/dashboard', '/dashboard/posts', '/admin', '/admin/users', '/sign-in', '/fwqa688'])
      expect(isListenerShellPath(p)).toBe(false);
  });
  it('не путает префиксы (/administrate ≠ /admin)', () => {
    expect(isListenerShellPath('/administrate')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm --filter @vire/web test -- listener-shell` → FAIL (модуль не найден).

- [ ] **Step 3: Реализация** — `apps/web/lib/listener-shell.ts`:

```ts
const NON_LISTENER_PREFIXES = ['/dashboard', '/admin', '/sign-in', '/fwqa688'];

/** Нужны ли на этом пути слушательские сайдбар/таб-бар (true), или у роута своя оболочка (false). */
export function isListenerShellPath(pathname: string): boolean {
  return !NON_LISTENER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
```

- [ ] **Step 4: Run, expect PASS** — `pnpm --filter @vire/web test -- listener-shell`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/listener-shell.ts apps/web/lib/listener-shell.test.ts
git commit -m "feat(shell): чистая функция isListenerShellPath"
```

---

## Task 3: Плеер публикует `--player-h`

**Files:**
- Modify: `apps/web/components/player/index.tsx:20-29`

**Interfaces:**
- Produces: CSS-переменная `--player-h` на `document.documentElement` = `4rem` когда есть трек, `0px` когда нет. Используется в Task 6 для высоты sticky-сайдбара.

Примечание: DOM-эффект, юнитом (env=node) не покрываем — верифицируем через `build` и визуально. TDD-цикл здесь неприменим.

- [ ] **Step 1: Реализация** — в `Player()` добавить эффект (рядом с существующими хуками), `track` уже подписан строкой `const track = usePlayerStore((s) => s.track);`:

```tsx
  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', track ? '4rem' : '0px');
    return () => document.documentElement.style.setProperty('--player-h', '0px');
  }, [track]);
```

(`useEffect` уже импортирован.)

- [ ] **Step 2: typecheck**

Run: `pnpm --filter @vire/web typecheck` → без ошибок.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/player/index.tsx
git commit -m "feat(player): публиковать --player-h для высоты сайдбара"
```

---

## Task 4: Мобильный таб-бар

**Files:**
- Create: `apps/web/components/listener/mobile-tab-bar.tsx`
- Modify: `apps/web/app/layout.tsx` (вставить `<MobileTabBar/>` после `<PlayerWrapper/>`)

**Interfaces:**
- Consumes: `isListenerShellPath` (Task 2), `Icon`, `usePathname`.
- Produces: `MobileTabBar` — flow-элемент `shrink-0 md:hidden`, рендерит 3 таба (Главная `/`, Поиск `/search`, Медиатека `/library`); возвращает `null` если `!isListenerShellPath(pathname)`.

- [ ] **Step 1: Реализация компонента** — `apps/web/components/listener/mobile-tab-bar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/icon';
import { isListenerShellPath } from '@/lib/listener-shell';
import { cn } from '@/lib/utils';

const TABS: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: '/', label: 'Главная', icon: 'home', exact: true },
  { href: '/search', label: 'Поиск', icon: 'search' },
  { href: '/library', label: 'Медиатека', icon: 'library' },
];

export function MobileTabBar() {
  const pathname = usePathname();
  if (!isListenerShellPath(pathname)) return null;

  return (
    <nav className="shrink-0 grid grid-cols-3 border-t border-border bg-background/95 backdrop-blur-sm md:hidden">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2 text-[11px] transition-colors',
              active ? 'text-foreground' : 'text-foreground/45 hover:text-foreground',
            )}
          >
            <Icon name={t.icon} size={20} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Примечание: проверить, что иконки `home`, `search`, `library` есть в `IconName` (`components/icon.tsx`). Если `library` нет — взять близкую существующую (`list`/`grid`/`disc`) и поправить тип.

- [ ] **Step 2: Проверить наличие иконок**

Run: `pnpm --filter @vire/web typecheck` → если `IconName` не содержит указанных имён, заменить на существующие (см. `components/icon.tsx`), пока не станет зелёным.

- [ ] **Step 3: Вставить в root layout** — `apps/web/app/layout.tsx`, импорт вверху и после `<PlayerWrapper />`:

```tsx
import { MobileTabBar } from '@/components/listener/mobile-tab-bar';
```
```tsx
          <PlayerWrapper />
          <MobileTabBar />
```

- [ ] **Step 4: typecheck + build**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web build` → зелёно.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/listener/mobile-tab-bar.tsx apps/web/app/layout.tsx
git commit -m "feat(shell): мобильный нижний таб-бар (Главная/Поиск/Медиатека)"
```

---

## Task 5: Вынести общие компоненты медиатеки + единый листенер-`Section`

**Files:**
- Move: `apps/web/app/profile/liked-track-row.tsx` → `apps/web/components/listener/liked-track-row.tsx`
- Move: `apps/web/app/profile/playlist-card.tsx` → `apps/web/components/listener/playlist-card.tsx`
- Move: `apps/web/app/profile/followed-artists.tsx` → `apps/web/components/listener/followed-artists.tsx`
- Create: `apps/web/components/listener/section.tsx`
- Modify: `apps/web/app/profile/page.tsx` (импорты на новые пути)

**Interfaces:**
- Produces:
  - `LikedTrackRow`, `PlaylistCard`, `FollowedArtists` доступны из `@/components/listener/*`. Сигнатуры пропсов не меняются.
  - `Section({ title, count?, href?, hrefLabel?, children })` из `@/components/listener/section` — единый editorial-заголовок секции для главной/`/library`/профиля (заменяет локальные дубли `Section`/`SectionHeader`). Для пустых состояний переиспользуем существующий `EmptyState` из `@/components/ui-kit` (props `{ title, hint? }`) — нового дубля НЕ создаём.

Контекст переиспользования (важно, память `feedback-decompose-reuse`): в проекте уже есть `components/ui-kit.tsx` с `Section`/`EmptyState`, но `ui-kit.Section` сделан в админ-эстетике (mono-uppercase label) и для editorial-страниц слушателя не подходит; локальные `Section`/`SectionHeader`/`EmptyState` дублируются в `app/page.tsx`, `app/profile/page.tsx`, `app/search/page.tsx`. Эта задача вводит ОДИН editorial-`Section`, который T8/T9/T11 используют вместо копий. `search` не переписываем в этом плане — его локальный helper не трогаем (вне scope, чтобы не расширять диф).

- [ ] **Step 1: git mv трёх файлов**

```bash
mkdir -p apps/web/components/listener
git mv apps/web/app/profile/liked-track-row.tsx apps/web/components/listener/liked-track-row.tsx
git mv apps/web/app/profile/playlist-card.tsx apps/web/components/listener/playlist-card.tsx
git mv apps/web/app/profile/followed-artists.tsx apps/web/components/listener/followed-artists.tsx
```

- [ ] **Step 2: Проверить внутренние относительные импорты перемещённых файлов**

Открыть три файла; любые относительные импорты (`./…`, `../…`) на соседей по `app/profile` перевести на `@/`-алиас. Импорты вида `@/…` и `@vire/…` не трогать.

- [ ] **Step 3: Обновить импорты в `app/profile/page.tsx`**

Заменить:
```tsx
import { LikedTrackRow } from './liked-track-row';
import { FollowedArtists } from './followed-artists';
import { PlaylistCard } from './playlist-card';
```
на:
```tsx
import { LikedTrackRow } from '@/components/listener/liked-track-row';
import { FollowedArtists } from '@/components/listener/followed-artists';
import { PlaylistCard } from '@/components/listener/playlist-card';
```

- [ ] **Step 4: Создать общий `components/listener/section.tsx`:**

```tsx
import Link from 'next/link';
import { Icon } from '@/components/icon';

export function Section({
  title,
  count,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  count?: number;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {hrefLabel ?? 'Все'}
            <Icon name="arrow-right" size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : count != null && count > 0 ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}
```

(Объединяет варианты: главная использовала `Section` с `href`/`hrefLabel`, профиль — `SectionHeader` с `count`. `arrow-right` — проверить в `IconName`.)

- [ ] **Step 5: typecheck + test**

Run: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test` → зелёно (поведение профиля не изменилось — импорты переехали, `section.tsx` пока не подключён).

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/components/listener apps/web/app/profile/page.tsx
git commit -m "refactor(listener): общие компоненты медиатеки + единый Section (убрать дубли)"
```

---

## Task 6: Сайдбар-компоненты (primary nav + библиотека)

**Files:**
- Create: `apps/web/components/listener/sidebar-primary-nav.tsx`
- Create: `apps/web/components/listener/library-sidebar.tsx`

**Interfaces:**
- Consumes: `SideNav` (`@/components/side-nav`), `Icon`, `next/image`, `next/link`.
- Produces:
  - `SidebarPrimaryNav` — client, `SideNav` с пунктами Главная (`/`, exact) и Медиатека (`/library`).
  - `LibrarySidebar` — server-friendly, пропсы `{ playlists, artists, likedCount, isGuest }`; рендерит заголовок «Медиатека», «Любимые треки» (ссылка `/library`), список плейлистов и артистов; для `isGuest` — промо «Войти».

Типы пропсов (вывести из возвращаемого `getUserPlaylists`/`getFollowedArtists`; не выдумывать поля):
```ts
type SidebarPlaylist = { id: string; name: string; coverUrl: string | null };
type SidebarArtist = { id: string; name: string; slug: string; avatarUrl: string | null };
```
(При расхождении полей с реальными возвращаемыми типами — взять реальные имена полей из `@vire/db`.)

- [ ] **Step 1: `sidebar-primary-nav.tsx`:**

```tsx
'use client';

import { SideNav, type SideNavItem } from '@/components/side-nav';

const NAV: SideNavItem[] = [
  { href: '/', label: 'Главная', icon: 'home', exact: true },
  { href: '/library', label: 'Медиатека', icon: 'library' },
];

export function SidebarPrimaryNav() {
  return <SideNav items={NAV} />;
}
```
(Если иконки `library` нет — заменить на существующую, согласовать с Task 4.)

- [ ] **Step 2: `library-sidebar.tsx`:**

```tsx
import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/icon';

type SidebarPlaylist = { id: string; name: string; coverUrl: string | null };
type SidebarArtist = { id: string; name: string; slug: string; avatarUrl: string | null };

export function LibrarySidebar({
  playlists,
  artists,
  likedCount,
  isGuest,
}: {
  playlists: SidebarPlaylist[];
  artists: SidebarArtist[];
  likedCount: number;
  isGuest: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35">
          Медиатека
        </span>
        {!isGuest && (
          <Link href="/library" aria-label="Все плейлисты" className="text-foreground/40 hover:text-foreground">
            <Icon name="plus" size={16} />
          </Link>
        )}
      </div>

      {isGuest ? (
        <div className="mx-2 rounded-lg bg-foreground/[0.04] p-4 text-sm">
          <p className="text-foreground/70">Войди, чтобы собирать любимое и плейлисты.</p>
          <Link href="/sign-in" className="mt-2 inline-block text-sm font-medium text-foreground hover:underline">
            Войти →
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pb-2 [scrollbar-width:thin]">
          <LibraryRow
            href="/library#liked"
            title="Любимые треки"
            subtitle={`${likedCount} треков`}
            leading={
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-gradient-to-br from-violet-500/70 to-sky-400/70">
                <Icon name="heart" size={16} className="text-white" />
              </span>
            }
          />

          {playlists.map((p) => (
            <LibraryRow
              key={p.id}
              href={`/playlists/${p.id}`}
              title={p.name}
              subtitle="Плейлист"
              leading={
                p.coverUrl ? (
                  <Image src={p.coverUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-foreground/10">
                    <Icon name="music" size={16} className="text-foreground/40" />
                  </span>
                )
              }
            />
          ))}

          {artists.map((a) => (
            <LibraryRow
              key={a.id}
              href={`/artists/${a.slug}`}
              title={a.name}
              subtitle="Артист"
              leading={
                a.avatarUrl ? (
                  <Image src={a.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground/10 font-mono text-sm">
                    {a.name[0]?.toUpperCase() ?? '?'}
                  </span>
                )
              }
            />
          ))}

          {playlists.length === 0 && artists.length === 0 && (
            <p className="px-2 py-3 text-xs text-foreground/40">Пока пусто. Лайкай треки и подписывайся на артистов.</p>
          )}
        </div>
      )}
    </div>
  );
}

function LibraryRow({
  href,
  title,
  subtitle,
  leading,
}: {
  href: string;
  title: string;
  subtitle: string;
  leading: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-foreground/5">
      {leading}
      <span className="min-w-0">
        <span className="block truncate text-sm">{title}</span>
        <span className="block truncate text-xs text-foreground/40">{subtitle}</span>
      </span>
    </Link>
  );
}
```

Примечание: иконки `plus`, `heart`, `music` — проверить в `IconName`; при отсутствии заменить.

- [ ] **Step 3: typecheck** — `pnpm --filter @vire/web typecheck` → зелёно (подогнать поля типов под реальные возвращаемые из `@vire/db`, имена иконок).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/listener/sidebar-primary-nav.tsx apps/web/components/listener/library-sidebar.tsx
git commit -m "feat(listener): компоненты сайдбара — primary nav + блок медиатеки"
```

---

## Task 7: Route-группа `(listener)` + layout с сайдбаром

**Files:**
- Move: `app/page.tsx` и каталоги `artists, releases, playlists, search, smartlink, profile, about, terms, privacy, feedback, design` → `app/(listener)/…`
- Create: `apps/web/app/(listener)/layout.tsx`
- Modify: `apps/web/app/layout.tsx` (убрать футер-обёртку из `#main-content`)
- Modify: `apps/web/app/__tests__/layout-shell.test.ts`

**Interfaces:**
- Consumes: `SidebarPrimaryNav`, `LibrarySidebar` (Task 6), `Footer`, `auth`, `getUserPlaylists`, `getFollowedArtists`, `getLikedTracks` (count).
- Produces: listener-страницы получают sticky-сайдбар (десктоп) + футер; URL не меняются.

- [ ] **Step 1: Создать группу и перенести страницы (git mv)**

```bash
mkdir -p "apps/web/app/(listener)"
git mv apps/web/app/page.tsx "apps/web/app/(listener)/page.tsx"
for d in artists releases playlists search smartlink profile about terms privacy feedback design; do
  git mv "apps/web/app/$d" "apps/web/app/(listener)/$d"
done
```

НЕ переносить: `(auth)`, `dashboard`, `admin`, `fwqa688`, `api`, `feed`, спец-файлы root (`layout.tsx`, `globals.css`, `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image.tsx`, иконки), `__tests__`.

- [ ] **Step 2: typecheck + build (без layout сайдбара)** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web build` → зелёно. Это подтверждает, что перенос не сломал импорты (всё на `@/`).

- [ ] **Step 3: Создать `app/(listener)/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { getUserPlaylists, getFollowedArtists, getLikedTracks } from '@vire/db';
import { Footer } from '@/components/footer';
import { SidebarPrimaryNav } from '@/components/listener/sidebar-primary-nav';
import { LibrarySidebar } from '@/components/listener/library-sidebar';

export default async function ListenerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  const [playlists, artists, liked] = userId
    ? await Promise.all([
        getUserPlaylists(userId),
        getFollowedArtists(userId),
        getLikedTracks(userId),
      ])
    : [[], [], []];

  return (
    <div className="flex">
      <aside className="sticky top-0 hidden h-[calc(100dvh-3rem-var(--player-h,0px))] w-64 shrink-0 flex-col self-start border-r border-border md:flex">
        <SidebarPrimaryNav />
        <LibrarySidebar
          playlists={playlists.map((p) => ({ id: p.id, name: p.name, coverUrl: p.coverUrl ?? null }))}
          artists={artists.map((a) => ({ id: a.id, name: a.name, slug: a.slug, avatarUrl: a.avatarUrl ?? null }))}
          likedCount={liked.length}
          isGuest={!userId}
        />
      </aside>

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </div>
  );
}
```

Примечание: `100dvh-3rem` = вьюпорт минус высота Nav (h-12). Поля `coverUrl`/`avatarUrl`/`name`/`slug` — сверить с реальными возвращаемыми типами `getUserPlaylists`/`getFollowedArtists`; подогнать маппинг.

- [ ] **Step 4: Убрать футер-обёртку из root `app/layout.tsx`**

Заменить блок:
```tsx
          <div id="main-content" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="min-h-full flex flex-col">
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </div>
```
на:
```tsx
          <div id="main-content" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {children}
          </div>
```
Удалить импорт `Footer` из root layout (теперь футер живёт в `(listener)/layout`). Дашборд/админка корректно заполняют `#main-content` своим `min-h-full` (статус-кво, без футера).

- [ ] **Step 5: Расширить `layout-shell.test.ts`** — добавить кейсы:

```ts
  it('(listener) layout: сайдбар — sticky-рейл, не второй скроллер', () => {
    const layout = readFileSync(path.join(APP_DIR, '(listener)', 'layout.tsx'), 'utf8');
    expect(layout).toMatch(/<aside[^>]*className="[^"]*\bsticky\b/);
    // у самого <aside> нет overflow-y-auto (скроллится внутренний список, не рейл)
    expect(layout).not.toMatch(/<aside[^>]*overflow-y-auto/);
  });

  it('root layout не дублирует футер (он в (listener) layout)', () => {
    const root = readFileSync(path.join(APP_DIR, 'layout.tsx'), 'utf8');
    expect(root).not.toMatch(/<Footer\s*\/>/);
  });
```

(Существующий кейс «корневой layout … overflow-y-auto» должен остаться зелёным — `#main-content` сохраняет `overflow-y-auto`.)

- [ ] **Step 6: Гейты** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test && pnpm --filter @vire/web check:routes && pnpm --filter @vire/web build` → всё зелёно.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/app
git commit -m "feat(shell): route-группа (listener) + sticky-сайдбар + футер в её layout"
```

---

## Task 8: Страница «Медиатека» `/library`

**Files:**
- Create: `apps/web/app/(listener)/library/page.tsx`

**Interfaces:**
- Consumes: `auth`, `getLikedTracks`, `getFollowedArtists`, `getUserPlaylists`, `getUserProfile` (если нужна статистика), `LikedTrackRow`, `PlaylistCard`, `FollowedArtists` (из `@/components/listener/*`), `PlayerTrack`.
- Produces: страница `/library` с секциями Плейлисты / Любимые треки (`#liked`) / Подписки; redirect гостя на `/sign-in?callbackUrl=/library`.

- [ ] **Step 1: Реализация** — собрать из текущего `app/(listener)/profile/page.tsx` (музыкальные секции), якорь `id="liked"` на секции лайков. Сетки/Stagger как в исходном профиле:

```tsx
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { FadeUp, Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getLikedTracks, getFollowedArtists, getUserPlaylists } from '@vire/db';
import type { PlayerTrack } from '@/store/player';
import { LikedTrackRow } from '@/components/listener/liked-track-row';
import { FollowedArtists } from '@/components/listener/followed-artists';
import { PlaylistCard } from '@/components/listener/playlist-card';
import { Section } from '@/components/listener/section';
import { EmptyState } from '@/components/ui-kit';

export const metadata: Metadata = { title: 'Медиатека' };
export const dynamic = 'force-dynamic';

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/library');

  const [likedTracks, followedArtists, playlists] = await Promise.all([
    getLikedTracks(session.user.id),
    getFollowedArtists(session.user.id),
    getUserPlaylists(session.user.id),
  ]);

  const likedQueue: PlayerTrack[] = likedTracks.map((t) => ({
    id: t.id, title: t.title, artistName: t.artistName,
    coverUrl: t.releaseCoverUrl, artistSlug: t.artistSlug, releaseId: t.releaseId,
  }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 space-y-14">
      <FadeUp>
        <h1 className="text-2xl font-semibold tracking-tight">Медиатека</h1>
      </FadeUp>

      <Section title="Плейлисты" count={playlists.length}>
        {playlists.length === 0 ? (
          <EmptyState title="Нет плейлистов" hint='Нажми «+» на странице трека, чтобы создать первый' />
        ) : (
          <Stagger step={0.04} className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {playlists.map((p) => (<StaggerItem key={p.id}><PlaylistCard playlist={p} /></StaggerItem>))}
          </Stagger>
        )}
      </Section>

      <div id="liked" className="scroll-mt-6">
        <Section title="Любимые треки" count={likedTracks.length}>
          {likedTracks.length === 0 ? (
            <EmptyState title="Ты ещё ничего не лайкал." />
          ) : (
            <Stagger step={0.035} className="flex flex-col">
              {likedTracks.map((track, i) => (
                <StaggerItem key={track.id}>
                  <LikedTrackRow
                    track={{ id: track.id, title: track.title, artistName: track.artistName, coverUrl: track.releaseCoverUrl, artistSlug: track.artistSlug, releaseId: track.releaseId }}
                    queue={likedQueue}
                    queueIndex={i}
                    durationSec={track.durationSec}
                    releaseCoverUrl={track.releaseCoverUrl}
                    artistSlug={track.artistSlug}
                    releaseId={track.releaseId}
                  />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </Section>
      </div>

      <Section title="Подписки" count={followedArtists.length}>
        <FollowedArtists initial={followedArtists} />
      </Section>
    </main>
  );
}
```

(Сверить пропсы `LikedTrackRow`/`PlaylistCard`/`FollowedArtists` с их реальными сигнатурами — копировать из исходного профиля 1:1. `Section`/`EmptyState` — общие из T5, локальных дублей НЕ заводить.)

- [ ] **Step 2: Гейты** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web build && pnpm --filter @vire/web check:routes` → зелёно.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(listener)/library/page.tsx"
git commit -m "feat(library): страница Медиатека (плейлисты/лайки/подписки)"
```

---

## Task 9: Ужать `/profile` до аккаунта

**Files:**
- Modify: `apps/web/app/(listener)/profile/page.tsx`

**Interfaces:**
- Produces: `/profile` показывает только аккаунт — `ProfileCard` (со статистикой), `LinkedAccounts`, ссылку «Моя медиатека → /library». Музыкальные секции удалены.

- [ ] **Step 1: Реализация** — оставить из текущего профиля только карточку и привязки аккаунтов; добавить ссылку на медиатеку. Статистику (likes/following/playlists) считаем как сейчас, но списки не рендерим:

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { FadeUp } from '@vire/ui/motion';
import { auth } from '@/auth';
import { getLikedTracks, getFollowedArtists, getUserPlaylists, getUserProfile } from '@vire/db';
import { ProfileCard } from './profile-card';
import { LinkedAccounts } from './linked-accounts';
import { Icon } from '@/components/icon';

export const metadata: Metadata = { title: 'Профиль' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ link_error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/profile');

  const { link_error: linkError } = await searchParams;
  const [likedTracks, followedArtists, playlists, profile] = await Promise.all([
    getLikedTracks(session.user.id),
    getFollowedArtists(session.user.id),
    getUserPlaylists(session.user.id),
    getUserProfile(session.user.id),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-14">
      <FadeUp>
        <ProfileCard
          user={{
            id: session.user.id,
            name: profile?.name ?? session.user.name ?? null,
            email: session.user.email ?? null,
            image: profile?.image ?? session.user.image ?? null,
            createdAt: profile?.createdAt ?? null,
          }}
          stats={{ likes: likedTracks.length, following: followedArtists.length, playlists: playlists.length }}
        />
      </FadeUp>

      <FadeUp delay={0.05}>
        <Link
          href="/library"
          className="group flex items-center justify-between rounded-lg border border-border px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
        >
          <span className="text-sm font-medium">Моя медиатека</span>
          <Icon name="arrow-right" size={16} className="text-foreground/40 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </FadeUp>

      <FadeUp delay={0.1}>
        <LinkedAccounts userId={session.user.id} linkError={linkError} />
      </FadeUp>
    </main>
  );
}
```

- [ ] **Step 2: Гейты** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test && pnpm --filter @vire/web build` → зелёно. (Если есть тест профиля, ссылающийся на удалённые секции — обновить.)

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(listener)/profile/page.tsx"
git commit -m "feat(profile): ужать до аккаунта; музыка уезжает в /library"
```

---

## Task 10: Удалить `/feed` (redirect → `/`)

**Files:**
- Modify: `apps/web/app/feed/page.tsx`
- (Удалить, если есть) тест ленты.

**Interfaces:**
- Produces: `/feed` отвечает серверным redirect на `/`. Контент фида остаётся секцией главной (Task 11).

- [ ] **Step 1: Заменить содержимое `app/feed/page.tsx`:**

```tsx
import { redirect } from 'next/navigation';

export default function FeedPage() {
  redirect('/');
}
```

Удалить все прочие импорты/экспорты из файла.

- [ ] **Step 2: Проверить ссылки на `/feed`**

Run: `grep -rn "/feed" apps/web --include=*.tsx --include=*.ts` → ссылок в навигации быть не должно (Nav уже почищен в Task 1; в `app/(listener)/page.tsx` секция фида использует данные, а не ссылку на `/feed`). Если найдётся ссылка-навигация — убрать.

- [ ] **Step 3: Гейты** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test && pnpm --filter @vire/web build && pnpm --filter @vire/web check:routes` → зелёно.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/feed/page.tsx
git commit -m "feat(feed): удалить страницу — redirect /feed → / (контент уехал на главную)"
```

---

## Task 11: Переработать главную (Spotify Home)

**Files:**
- Modify: `apps/web/app/(listener)/page.tsx`

**Interfaces:**
- Produces: главная с персональным верхом для вошедших (быстрый доступ из лайков/фида, «Новое у подписок»), затем «Сделано для тебя» (Волна + настроение), подборки, live, скоро, свежие, артисты. Гостю — дискавери-порядок. Данные — те же существующие запросы (никаких новых).

Дефолты (из спеки): историю прослушивания НЕ тянем (нет готового запроса) — «быстрый доступ» строим из `feed`/лайков/подборок. Перф-инварианты сохраняем: `FeaturedRelease` без fade (LCP); секции-сетки без motion-обёрток.

- [ ] **Step 1: Реализация** — переставить секции существующего `page.tsx` в порядок Home; для вошедших поднять блок «Новое у тех, на кого подписан» (`feed`) и «Сделано для тебя» (`WaveStartButton` + `MoodWaveChips`) выше дискавери; гостю оставить дискавери-порядок (featured → волна → подборки → свежие → артисты). Использовать уже импортированные данные/компоненты файла (`getFeed`, `getLatestReleases`, `getUpcomingReleases`, `listReleases`, `listActiveArtists`, `getEditorialPlaylists`, `getMoodCounts`, `getListeningNow`, плейлисты). Логику дедупа/добивки подборок оставить как есть.

Структура (псевдо-разметка, конкретные секции — перенос существующих):
```tsx
  const isAuthed = !!userId;
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 space-y-16">
      <JsonLd data={websiteJsonLd()} />
      <h1 className="sr-only">VireMusic — независимая музыкальная площадка…</h1>

      {featured && <FeaturedRelease release={featured} />}

      {isAuthed && feed.length > 0 && (
        <Section title="Новое у тех, на кого ты подписан">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {feed.slice(0, 8).map((r) => (<ReleaseQuickLook key={r.id} release={r} />))}
          </div>
        </Section>
      )}

      {/* Сделано для тебя */}
      <WaveStartButton />
      {moodCounts.length > 0 && (
        <Section title="По настроению"><MoodWaveChips moods={moodCounts} /></Section>
      )}

      <ListeningNow initial={listeningNow} />

      {editorialPlaylists.length > 0 && (
        <Section title="Подборки">{/* …существующая сетка… */}</Section>
      )}
      {publicPlaylists.length > 0 && (
        <Section title="Плейлисты слушателей">{/* … */}</Section>
      )}
      {upcoming.length > 0 && (<Section title="Скоро выйдет">{/* … */}</Section>)}
      {rest.length > 0 && (<Section title="Свежие релизы" href="/releases" hrefLabel="Посмотреть все">{/* … */}</Section>)}
      {topArtists.length > 0 && (<Section title="Артисты" href="/artists" hrefLabel="Все артисты">{/* … */}</Section>)}

      {empty && (<p className="text-center text-sm text-muted-foreground py-12">Пока пусто. Скоро здесь появится музыка.</p>)}
    </main>
  );
```
Убрать `Reveal`-обёртки с секций-сеток (память: scroll-jitter). Локальный `Section` в `page.tsx` **удалить**, импортировать общий `import { Section } from '@/components/listener/section'` (он покрывает прежние пропсы `title`/`href`/`hrefLabel`). Импорт `Icon`, если оставался только ради локального `Section`, — убрать.

- [ ] **Step 2: Гейты** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web lint && pnpm --filter @vire/web build` → зелёно.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(listener)/page.tsx"
git commit -m "feat(home): переработка под Spotify Home (персональный верх + дискавери)"
```

---

## Task 12: Расширить футер

**Files:**
- Modify: `apps/web/components/footer.tsx`

**Interfaces:**
- Produces: футер с колонкой Площадка, включающей и Артисты, и Релизы (компенсация ухода из шапки), + существующие Поддержка/Правовое.

- [ ] **Step 1: Реализация** — в колонку «Площадка» добавить `Релизы`:

```tsx
            <FooterCol title="Площадка">
              <FooterLink href="/artists">Артисты</FooterLink>
              <FooterLink href="/releases">Релизы</FooterLink>
              <FooterLink href="/about">О платформе</FooterLink>
              <FooterLink href="/design">Дизайн</FooterLink>
              <li><AnnouncementReopenLink id="stage1" className={reopenCls} /></li>
            </FooterCol>
```

(Остальные колонки без изменений.)

- [ ] **Step 2: Гейты** — `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web build` → зелёно.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/footer.tsx
git commit -m "feat(footer): добавить Релизы (компенсация ухода ссылок из шапки)"
```

---

## Task 13: Финальная верификация, самокритика, доки, версия

**Files:**
- Create: `docs/features/listener-shell.md`
- Modify: `package.json`, `apps/web/package.json` (версия)

- [ ] **Step 1: Полный прогон гейтов**

```bash
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
Все зелёные. Вывод приложить (Iron Law).

- [ ] **Step 2: Самокритика отдельным сабагентом (Sonnet)** — прожарить диф по VireMusic-чеклисту: мобилка (узкий вьюпорт, таб-бар + плеер стекаются, sticky-сайдбар не даёт второй скролл), дубли компонентов, утечки/ререндеры, app-shell (нет `min-h-screen`, `#main-content` единственный скроллер), краевые случаи (гость в сайдбаре, пустая медиатека, дашборд без футера и без сайдбара/таб-бара). Найденное — починить и перепрожарить.

- [ ] **Step 3: Ручная проверка (если есть запуск)** — `/`, `/library`, `/profile`, `/search`, `/dashboard`, `/admin`, `/feed`(→`/`) на десктопе и узком вьюпорте; играющий и непустой плеер (высота сайдбара через `--player-h`).

- [ ] **Step 4: Doc фичи** — `docs/features/listener-shell.md` по шаблону `docs/features/README.md`: что делает, где код (route-группа `(listener)`, `components/listener/*`, `lib/listener-shell.ts`), ограничения (нет истории прослушивания, без реактивного обновления библиотеки — revalidate), env — нет.

- [ ] **Step 5: Бамп версии** в двух местах (корневой + `apps/web/package.json`), `pnpm install` (lockfile), отдельный коммит. Тег — по отдельной команде пользователя (не в этом плане).

- [ ] **Step 6: Commit**

```bash
git add docs/features/listener-shell.md package.json apps/web/package.json pnpm-lock.yaml
git commit -m "docs(features): дашборд слушателя; bump версии"
```

---

## Self-Review (выполнено автором плана)

**Покрытие спеки:** оболочка/route-группа → T7; Nav → T1; сайдбар → T6+T7; мобильный таб-бар → T2+T4; `--player-h` → T3; общие компоненты → T5; `/library` → T8; `/profile` → T9; `/feed` → T10; главная → T11; футер → T12; тесты/инварианты → T1/T2/T7/T13; доки+версия → T13. Все разделы спеки имеют задачу.

**Плейсхолдеры:** код приведён для всех новых файлов; места «сверить поля с реальными типами `@vire/db`» — это не плейсхолдер логики, а явная сверка имён полей (формы возвращаемых строк нельзя выдумывать), с указанием источника истины.

**Согласованность типов:** `isListenerShellPath` (T2) используется в T4. `SidebarPlaylist/SidebarArtist` (T6) маппятся в T7. `--player-h` (T3) читается в T7. `LikedTrackRow/PlaylistCard/FollowedArtists` (T5) — в T8. Общий `Section` (T5) — в T8/T11; `EmptyState` из `ui-kit` — в T8. Имена иконок (`home/search/library/plus/heart/music/arrow-right`) помечены к сверке с `IconName` в первой задаче, где встречаются.

**Декомпозиция и переиспользование (память `feedback-decompose-reuse`):** перед новыми компонентами проверено существующее. Переиспользуются: `SideNav` (primary nav, T6), `Icon`, `next/image`, `EmptyState` из `ui-kit` (T8), перенос (не копирование) `LikedTrackRow/PlaylistCard/FollowedArtists` (T5). Дубли устранены: единый editorial-`Section` вместо локальных копий в главной/профиле/library (T5→T8/T11); внутренний `LibraryRow` вместо повтора разметки строк плейлиста/артиста (T6). Новые компоненты оправданы отсутствием аналога: `MobileTabBar` (паттерн fixed-grid ≠ горизонтальные пилюли `SideNav`), `LibrarySidebar` (компактный рейл ≠ грид-карточки `PlaylistCard`). Вне scope осознанно оставлен локальный `SectionHeader` в `search` (страницу не переписываем).
