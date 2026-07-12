# §7.1 — доводка Волны: материализация профиля вкуса + вес источника запуска

> Stage-2 §7.1 / roadmap-1.0 блок 1 «Будущее». Две независимые части, один цикл.

## Часть А — материализация профиля вкуса

### Сейчас

`getTasteProfile(userId)` (`packages/db/src/queries/taste.ts`) на каждый промах
per-process TTL-кэша (60с, `createTtlCache`) гонит три параллельных `GROUP BY` по
`likes` ∪ `play_events` (окно 90 дней). Потребители: волна (`/api/v1/wave`) и личные
подборки (`editorial.ts` → `generatePersonalPlaylists`). Кэш не шарится между
процессами web/worker — каждая реплика бьёт БД сама.

### Решение: таблица Postgres, пересчёт в существующем editorial-кроне

**Не Redis:** профиль — persistent-агрегат для двух независимых потребителей, должен
переживать рестарт Redis и быть joinable; Redis в проекте — только эфемерное
(presence, wave-сессия).

1. **Схема** — новая таблица `taste_profiles` (`packages/db/src/schema/`):
   `user_id uuid PK (FK users, cascade)`, `top_moods text[]`, `top_genres text[]`,
   `top_artist_ids uuid[]`, `computed_at timestamp not null`. Миграция `0034`.
2. **Пересчёт** — `materializeTasteProfiles()` в `taste.ts`: для всех юзеров с
   сигналом (те же, кого итерирует `generatePersonalPlaylistsForAllUsers`) считает
   `fetchTasteProfile` и упсертит строку. Вызывается **первым шагом** обработчика
   `personal`-scope в `apps/worker/src/workers/editorial.worker.ts` — личные подборки
   в том же прогоне берут уже свежие профили. Нового scheduler'а/очереди не заводим
   (`personal-4h` уже есть, идемпотентный `upsertJobScheduler`).
3. **Чтение** — `getTasteProfile(userId)`: TTL-кэш (остаётся как L1) → point-lookup
   `taste_profiles` по PK → **fallback на живой `fetchTasteProfile`** только если
   строки нет (новый юзер до ближайшего крона), с write-through upsert'ом.
   `computed_at` по возрасту не инвалидируем — крон и так каждые 4ч; протухшая
   строка лучше трёх GROUP BY.
4. **Ручной прогон** — `POST /api/v1/admin/editorial` (`generateAllEditorialPlaylists`)
   тоже должен материализовать первым шагом (единый код-путь с воркером).

### Деградация

- Ошибка материализации одного юзера не валит прогон (лог + continue).
- Волна без профиля работает как сейчас (глобальные сигналы) — не меняется.

## Часть Б — вес источника запуска в скоринге

### Сейчас

`play_events.source` (`'wave'|'release'|'playlist'|'artist'|'home'|'feed'|'search'|'liked'|'purchased'|'direct'`)
пишется, но в `wave.ts` не участвует: `qualityScore` усредняет долю дослушивания по
всем событиям одинаково, `fatiguePenalty` не различает источники.

### Решение: два терма, константы в core

1. **Взвешенный `qualityScore`** — вместо `AVG(ratio)` взвешенное среднее
   `SUM(w·ratio)/SUM(w)`, где `w` по источнику: скип рекомендации волны — сильный
   сигнал, скип собственного выбора — слабый:
   - `wave` → 1.0; `playlist`, `liked`, `purchased` → 0.6 (осознанный выбор юзера);
   - остальные (`release`, `artist`, `home`, `feed`, `search`, `direct`) → 0.8.
2. **`waveSkipPenalty`** — новый штраф: у слушателя есть событие по этому треку с
   `source='wave'` и дослушиванием < 30% за последние 30 дней → **−0.4**
   («волна уже предлагала — не понравилось, не возвращать так скоро»).
   Существующий `fatiguePenalty` (−0.6/7 дней) не трогаем — термы складываются.
3. **Константы и мапка** — в `packages/core` (например `src/services/wave-scoring.ts`):
   `sourceQualityWeight(source): number`, `WAVE_SKIP_PENALTY`, `WAVE_SKIP_THRESHOLD`,
   `WAVE_SKIP_WINDOW_DAYS` — чистые, с юнит-тестами (полный перебор PLAY_SOURCES).
   В `wave.ts` вшиваются через `sql.raw` по образцу `exactWeight`/`familyWeight`
   в `genreOverlapTerm` — довыполняем намерение спеки recsys-rework «сигналы в core».
4. Оба терма — только в режиме похожести и seed-режиме вошедшего там, где сейчас
   есть `qualityScore`; анонимный режим (популярность×random) не трогаем.

### Производительность

Покрывающий индекс `play_events_track_started_covering_idx` (0033) должен накрывать
взвешенный вариант qualityScore (те же колонки + `source` — проверить; если `source`
не в include — расширить индекс в той же миграции 0034). `waveSkipPenalty` —
коррелированный exists по `(user_id, track_id, source, started_at)`: смотреть план,
при необходимости — частичный индекс `where source = 'wave'` в 0034.

## Тесты

- core: `sourceQualityWeight` (перебор всех источников + неизвестный → дефолт),
  константы штрафа.
- db: рендер-тест SQL-термов по образцу `wave-order.test.ts` (PgDialect, без БД) —
  веса из core реально попадают в SQL.
- web: `wave/route.test.ts` не ломается (моки `getTasteProfile` не меняют сигнатуру).
- worker: тест editorial.worker — `personal`-scope зовёт материализацию до генерации
  (мок `@vire/db`).

## Дока

Обновить `docs/features/wave.md` (новые термы, материализация) и
`docs/features/curated-playlists.md` (источник профиля — таблица). Отметить
`roadmap-1.0.md` строку «Будущее» и stage-2 §7.1.

## Вне скоупа

- Персистентная история анти-повтора (Redis TTL 6ч остаётся).
- Изменение самих весов существующих сигналов.
- TECHNICAL_DEBT.md про «прямые инсерты play_events» устарел (буфер есть с ceed2dc) —
  чинится в §1-цикле, не здесь.
