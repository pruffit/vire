# Срез 4 — таблицы — план реализации

Спека: `docs/superpowers/specs/2026-07-26-mobile-slice-4-tables-design.md`.
Десктоп неизменён; мобилка через `md:`-варианты. Минимум комментов.

## Часть A — примитив (ui-kit.tsx) + тест (Agent A)

Файл `apps/web/components/ui-kit.tsx`.

### `Table`
- Дефолт пропа: `minWidth = 'md:min-w-[640px]'` (был `'min-w-[640px]'`).
- Обёртка-div: `className="md:rounded-xl md:border md:border-foreground/10 md:overflow-x-auto"`
  (рамка/скролл только на `md`; на мобилке рамку дают карточки-строки).
- `<table>` className:
  `cn('w-full text-sm block md:table [&_tbody]:block md:[&_tbody]:table-row-group', minWidth, className)`
  (НЕ интерполировать md в рантайме — `minWidth` приходит готовым `md:…` литералом).

### `Thead`
- `<thead className="hidden md:table-header-group">` (внутренний `<tr>` без изменений).

### `Tr`
- className:
  `cn('block rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 mb-2.5 last:mb-0', 'md:table-row md:rounded-none md:border-0 md:border-b md:border-foreground/[0.06] md:bg-transparent md:p-0 md:mb-0 md:last:border-0', 'transition-colors hover:bg-foreground/[0.03]', className)`

### `Td`
- Новый проп `label?: string`.
- `const showLabel = label != null && label !== '';`
- className:
  `cn('block w-full py-1.5 align-middle md:table-cell md:w-auto md:px-3 md:py-2.5', showLabel && 'flex items-center justify-between gap-4', tone/align/mono/nums/nowrap как сейчас (align — оставить unconditional text-*), className)`
- Рендер:
  ```tsx
  {showLabel && (
    <span className="md:hidden shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/40">{label}</span>
  )}
  <span className={cn('md:contents', showLabel && 'min-w-0 text-right')}>{children}</span>
  ```

### `ActionLink` (тач-таргет)
- В className добавить `pointer-coarse:min-h-11` (к существующему `inline-flex items-center …`).

### Тест
- `apps/web/components/ui-kit.test.tsx` (создать или дополнить): рендер
  `<Table><Thead><Th>Email</Th></Thead><tbody><Tr><Td label="Email">a@b.c</Td><Td>без подписи</Td></Tr></tbody></Table>`
  → есть текст «Email» и «a@b.c»; ячейка без label рендерит только «без подписи» (подпись не дублируется).

## Часть B — применение (после A) (Agent B)

Для КАЖДОГО из 8 файлов с `<Table>`:
1. Проп `minWidth` → `md:`-префикс: `minWidth="min-w-[880px]"` → `minWidth="md:min-w-[880px]"` (и т.д.
   по факту в каждом файле; если minWidth не задан — не трогать, дефолт уже md).
2. Каждому `<Td>` добавить `label="<текст колонки из соответствующего Th>"`, КРОМЕ:
   - первичной ячейки (название/email — она станет заголовком карточки) — `label` НЕ ставить;
   - ячейки действий (Select/кнопки) — `label` НЕ ставить (футер карточки на всю ширину);
   - ячеек с `colSpan` (пустые состояния) — `label` НЕ ставить.
   Подписи брать дословно из `Th` той же колонки.

Файлы и колонки (порядок Th — источник подписей):
- `app/admin/users/page.tsx` — Email(title, без label)/Имя/Роль/Артист/Дата/действия(без label).
- `app/admin/tracks/page.tsx` — Трек(title)/Релиз/Артист/Статус/Аудио/Прослуш./Лайки/Дата/действия(без label).
- `app/admin/artists/page.tsx` — Артист(title)/Фолловеры/Релизы/Треки/Прослуш.30д/Создан/действия(без label).
- `app/admin/releases/page.tsx` — Релиз(title)/Артист/Тип/Треков/Дата/действия(без label).
- `app/admin/reports/page.tsx` — Причина(title)/Цель/От кого/Дата/Действие(без label).
- `app/admin/playlists/playlist-admin-row.tsx` — Название(title, inline input)/Тип/Видимость/Треки/Лайки/Владелец/Создан/действия(без label).
- `app/admin/page.tsx` — две таблицы: очереди (Очередь(title)/waiting/active/delayed/failed) и
  RecentReleases (без Thead — первой ячейке label не ставить, остальным дать осмысленные: Артист/Статус/Дата).
- `app/(listener)/design/page.tsx` — showcase-таблица: проставить label по её же Th (демонстрирует паттерн).

3. Тач-таргеты локальных иконок-действий (добавить `pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center` к иконкам-кнопкам `p-1.5`):
   - `app/admin/playlists/playlist-admin-row.tsx` (иконки сохранить/открыть/удалить);
   - `app/dashboard/links/smart-link-list.tsx` (локальный `IconButton`, ~стр. 15).

4. Реальный баг + формы (дашборд):
   - `app/dashboard/posts/posts-manager.tsx` (~стр. 224): кнопки Изм./Удалить `opacity-0 group-hover:opacity-100`
     → добавить `pointer-coarse:opacity-100`.
   - `app/dashboard/releases/[id]/... edit-release-form.tsx` он же `release-edit-form.tsx` (~стр. 73):
     `grid-cols-2` → `grid grid-cols-1 sm:grid-cols-2`.
   - `app/admin/tracks/[id]/edit/track-edit-form.tsx` (~стр. 212): `grid-cols-2` → `grid grid-cols-1 sm:grid-cols-2`.

## Blast radius / переиспользование

Примитив уже общий — рефлоу автоматически покрывает все 8 таблиц. Дубли не плодим. Проверить,
что ни одна таблица не сломалась (build + прогон). `design/page.tsx` — dev-showcase, безопасен.

## Doc / ledger

- `docs/features/mobile-patterns.md` — добавить раздел «Таблицы»: примитив `Table` рефлоит в
  карточки под `md`; `Td label="…"` = подпись на мобилке; первичная ячейка/действия — без label;
  `minWidth` передавать `md:`-префиксом.
- `.superpowers/sdd/progress.md` — блок Среза 4.

## Гейты (Iron Law)

typecheck · lint · check:routes · test · audit:design · build — свежий прогон перед «готово».
