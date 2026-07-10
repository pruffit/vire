# План: закрытие отложенных MINOR-находок аудитов (11.07.2026)

Источник: память `project-vire-ui-audit-backlog` + `docs/roadmap/TODO.md`.
Пять независимых правок, Этап 2 не затрагивается. Продуктовых развилок нет —
все решения инженерные.

## 1. TOCTOU автоприменения жанров (worker)

**Проблема.** `apps/worker/src/workers/transcode.worker.ts:65-67`: чтение
`getTrackGenres` → `decideAutoApplyGenres` → `setTrackGenres` не атомарно.
`setTrackGenres` делает delete-all + insert: ручной выбор артиста в окне между
чтением и записью перезаписывается.

**Фикс.**
- `packages/db/src/queries/track-genres.ts`: новая `setTrackGenresIfEmpty(trackId, genres)` —
  один атомарный стейтмент `INSERT INTO track_genres (track_id, genre)
  SELECT … WHERE NOT EXISTS (SELECT 1 FROM track_genres WHERE track_id = …)`.
  Возвращает boolean (вставили или нет) — для лога воркера. Экспорт в `index.ts`.
- `apps/worker/src/lib/genre-policy.ts`: `decideAutoApplyGenres` теряет параметр
  `existingGenres` (проверка пустоты уехала в SQL) → переименовать смысл в
  «отбор кандидатов по порогу/количеству». Обновить jsdoc: авто-применение
  защищено `setTrackGenresIfEmpty` на уровне SQL.
- Воркер: убрать вызов `getTrackGenres`, вызывать `setTrackGenresIfEmpty`.
- Тесты: обновить существующие тесты политики/пайплайна (apps/worker),
  замокать новую функцию там, где мокался `setTrackGenres`.

## 2. Каст string→Genre без runtime-проверки (jsonb genre_suggestions)

**Проблема.** `apps/web/app/dashboard/releases/[id]/page.tsx:84` и
`apps/web/app/admin/tracks/[id]/edit/page.tsx:42` — `as { genre: Genre; … }[]`
на jsonb: при рассинхроне enum GenrePicker получает `undefined`-лейбл.

**Фикс.**
- `apps/web/lib/genres.ts`: type guard `isGenre(v: string): v is Genre` через
  `v in GENRE_LABELS` (без runtime-импорта core — ключи `Record<Genre, string>`
  уже полный список, что закреплено существующим тестом полноты).
- Обе страницы: `(map[id] ?? []).filter((s) => isGenre(s.genre))` вместо каста.
- Тест на `isGenre` в `lib/__tests__/genres.test.ts`.

## 3. Клавиатурный reorder очереди плеера

**Проблема.** `apps/web/components/player/queue-panel.tsx` — reorder только
драгом за грип (`aria-hidden` span), клавиатуры нет.

**Фикс.**
- Грип `span` → `button` (фокусируемый): `aria-label` вида «Переместить трек
  „…“, стрелки вверх/вниз», `onKeyDown` ArrowUp/ArrowDown →
  `moveTrack(trackId, ±1)` (preventDefault, чтобы не скроллить панель).
- `moveTrack` — общая функция рядом с `handleReorder`: переставляет элемент в
  `queue` и пересчитывает `queueIndex` тем же путём (`_setState`).
- Драг за грип сохраняется (`onPointerDown` остаётся). Фокус после перестановки
  остаётся на кнопке (key=t.id сохраняет identity элемента).
- Визуал не меняется (та же иконка GripIcon), только семантика.

## 4. Дубль TrackCredit/ContributorRole (web lib/upload ↔ core)

**Проблема.** `apps/web/lib/upload.ts:31-37` дублирует типы из
`packages/core/src/types/release.ts:97-102` + runtime-список `VALID_ROLES`.

**Фикс.**
- Core `types/release.ts`: `export const ALL_CONTRIBUTOR_ROLES = […] as const;`
  `export type ContributorRole = (typeof ALL_CONTRIBUTOR_ROLES)[number];`
  (паттерн как у `ALL_GENRES`/`Genre`). Проверить экспорт из index.
- `apps/web/lib/upload.ts`: убрать локальные объявления, реэкспорт
  `export type { TrackCredit, ContributorRole } from '@vire/core';`
  (паттерн уже есть — `isUuid`); `VALID_ROLES` → `ALL_CONTRIBUTOR_ROLES` из core.
  Потребители (`credits-editor`, `track-manager`, `admin/actions`, `track-edit-form`,
  `lib/track-display`) импортируют из `@/lib/upload` — их не трогаем.
- upload.ts импортируется и клиентскими компонентами только type-only — runtime
  импорт core в самом upload.ts (серверном) допустим.

## 5. key={i} в links-editor / videos-editor

**Проблема.** Мутируемые списки с ключом-индексом: удаление из середины
переиспользует DOM/стейт соседних строк (фокус/каретка).

**Фикс.**
- Общий хук `useStableListKeys(length)` в `apps/web/lib/use-stable-list-keys.ts`:
  ref-массив монотонных id, синхронизируемый по операциям `append`/`removeAt`;
  при внешнем рассинхроне длины — дозаполнение/усечение (деградация не хуже
  текущего key=i). API: `{ keys, add, remove }` — редакторы зовут `add()`/`remove(i)`
  в своих `add`/`remove` хендлерах.
- `links-editor.tsx`, `videos-editor.tsx` — `key={keys[i]}`.
- Тест хука (vitest, renderHook) — стабильность ключей при удалении из середины.

## Оркестрация

- Агент A (Sonnet): пункт 1 (db + worker + тесты воркера).
- Агент B (Sonnet): пункты 2 + 4 (core types + web lib + страницы).
- Агент C (Sonnet): пункты 3 + 5 (клиентские компоненты + тесты).
- Параллельно, файлы не пересекаются. Затем независимая самокритика (Sonnet),
  гейты (typecheck web/core/db + worker, lint, check:routes, test, audit:design, build), коммит.

## Не делаем

- CSP `'unsafe-inline'` — отложено осознанно (TECHNICAL_DEBT.md), не под этот заход.
- Sentry/Observability — ждёт апгрейда VPS.
- Этап 2 — только по команде.
