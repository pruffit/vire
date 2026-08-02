# План — вечеринка, срез A: домен и данные (01.08.2026)

Дизайн: `../specs/2026-08-01-party-mode-design.md`. Срез A ничего не показывает
пользователю: он готовит модель, на которую лягут резолвер (B) и поверхности (C).
Существующий джем после среза A обязан вести себя ровно как раньше.

## 1. Миграция (`packages/db`, следующий свободный номер — сейчас 0045)

- `jam_session_kind` enum `('JAM','PARTY')`; `jam_sessions.kind` NOT NULL DEFAULT `'JAM'`.
- `jam_queue_source` enum `('VIRE','YOUTUBE','SOUNDCLOUD')`; `jam_queue_items.source`
  NOT NULL DEFAULT `'VIRE'`.
- `jam_queue_items.track_id` — снять NOT NULL (FK остаётся).
- Добавить `external_id text`, `external_url text`, `title text`, `artist_name text`,
  `cover_url text`, `duration_sec integer`.
- CHECK-инвариант: `VIRE` ⇒ `track_id IS NOT NULL AND external_id IS NULL`;
  иначе ⇒ `track_id IS NULL AND external_id IS NOT NULL AND title IS NOT NULL`.

Генерировать через `pnpm --filter @vire/db db:generate`, руками править только то, что
Drizzle не умеет декларативно (CHECK — умеет, см. `jam_participants_one_identity`).

## 2. Типы и домен (`packages/core`)

`JamQueueItem` — плоский тип с дискриминатором `source`, не размеченное объединение:
поля своего каталога (`trackId`, `artistSlug`, `releaseId`, `accentColor`, `isExplicit`,
`version`, `feat`) становятся nullable, `title`/`artistName`/`coverUrl`/`durationSec`
общие. Причина выбора — размер радиуса поражения: строгое объединение заставит переписать
всех потребителей строки очереди ради выгоды, которую даёт один явный гард в UI.

`JamSession.kind: JamSessionKind` (`'JAM' | 'PARTY'`).

### Playback ссылается на позицию очереди

`JamPlaybackState.trackId` → `itemId` (id строки очереди). Это же чинит существующую
двусмысленность: один трек, добавленный дважды, сейчас всегда резолвится в первое
вхождение (`findIndex` по `trackId`).

Затронуто: `jam-sync.ts`, `jam.ts` (сервис playback-команд), порт `jam-state.ts`,
Redis-адаптер `apps/web/lib/jam/jam-state.ts`, zod-схема
`app/api/v1/jam/[code]/playback/route.ts`, клиент (`jam-session-provider.tsx`,
`jam-room.tsx`, `mini-bar.tsx`, `use-playback-sync.ts` — грузит трек по id) и их тесты.

Живые джемы переживают деплой с протухшим playback в Redis (ссылка на несуществующую
позицию) — клиент в этом случае показывает «ничего не играет», это допустимо: сессии
эфемерны и авто-закрываются за 12ч. Не городить миграцию Redis-состояния.

**Аналитика только для своих треков:** `play_events`/прослушивания по внешним позициям
не пишутся (нет `track_id`). Проверить все места, где джем пишет статистику.

**Сохранение очереди в плейлист** (`save-playlist`) берёт только `source='VIRE'`;
внешние позиции молча пропускаются (UI-сообщение — в срезе C).

## 3. Добавление внешней позиции

Метод сервиса, принимающий уже разрезолвленный дескриптор (сам резолв — срез B):
`{ source, externalId, externalUrl, title, artistName, coverUrl, durationSec }`.
Гарды: сессия `LIVE`; внешние позиции разрешены **только** при `kind='PARTY'` (в обычном
джеме — `ValidationError`); существующие лимиты очереди/частоты добавления действуют
одинаково для обоих источников.

## 4. Круговая очередь (только `kind='PARTY'`)

Чистая функция в `packages/core` (рядом с `jam-queue.ts`): позиция вставки новой позиции
считается так, чтобы треки гостей шли по кругу — второй трек гостя не встаёт раньше
первого трека того, кто ещё не звучал. Ограничения: не двигать текущую играющую позицию
и всё, что до неё; ручной перенос (DnD) остаётся авторитетным — переупорядочивание
применяется только в момент добавления.

Покрыть тестами: один гость (порядок = FIFO), три гостя вперемешку, добавление во время
игры (ничего до текущей позиции не двигается), пустая очередь.

## 5. Тесты

- `packages/core`: круговая очередь, playback по `itemId` (включая дубликат трека в
  очереди), гард внешних позиций в обычном джеме, save-playlist пропускает внешние.
- `apps/web`: обновить существующие jam-тесты под `itemId`; роут playback (валидация),
  роут очереди (внешняя позиция в `JAM` → 400, в `PARTY` → 201).

## 6. Гейты

`typecheck` (web/core/db) · `lint` · `check:routes` · `test` · `build`.
Миграцию прогнать на локальной базе (`docker compose up -d`,
`pnpm --filter @vire/db db:migrate`) и убедиться, что существующий джем работает:
создать сессию, добавить свой трек, включить воспроизведение.

## Ограничения

- Комментарии — только неочевидное «почему», 1–2 строки.
- `packages/core` не импортирует ничего из Next.
- Никакого UI в этом срезе; `/party` и экран вечеринки — срез C.
