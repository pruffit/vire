# Волна (алгоритм рекомендаций)

«Волна» — персональный бесконечный поток треков. Запускается с главной (чипы
настроений/жанров) или автоматически в плеере, когда очередь подходит к концу.

## Что делает

### Два режима запроса

- **Seed-режим** (`trackId` не передан — старт волны/пустая очередь без текущего трека):
  - Есть `mood`/`genre` в запросе — фильтр по тегу настроения (`track_moods`) и/или
    жанру (`track_genres`, расширенному до семейства seed-жанра — см. ниже; фолбэк на
    `releases.genre`, если у трека нет своих тегов).
  - Вошедший слушатель без явного mood/genre — ранжирование по профилю вкуса
    (`getTasteProfile`: топ-5 настроений/жанров/артистов по лайкам ∪ прослушиваниям
    за 90 дней) + качество дослушивания + шум.
  - Аноним без сигнала — популярность за 30 дней (`ln(plays+1) * random()`), ротация.
- **Режим похожести** (`trackId` передан — очередь исчерпывается во время волны):
  взвешенный скоринг похожести с текущим треком + поведенческие сигналы:
  mood-совпадение, BPM (±5/±15/±30), тональность (см. ниже), жанр (приоритет —
  `track_genres` кандидата, точное + семейное совпадение, см. ниже; фолбэк на
  `releases.genre`, до 0.3), вкус (mood до 0.25; genre — точное + семейное, см. ниже),
  качество дослушивания (до 0.3), вовлечённость по «любимым моментам» (до 0.2),
  анти-усталость (-0.6 за трек, слышанный за 7 дней), разнообразие артистов
  (-0.4 за артиста из последних 5 выданных), сессионный буст по mood (+0.35,
  закреплён в начале сессии) и по genre — точный/семейный, см. ниже, шум
  (`random() * 0.15`).

### Жанровый сигнал: точный / семейство

После расширения справочника жанров до Discogs-400 (~370 значений, см.
`docs/features/auto-genre.md`) чистое точное пересечение жанров разрежает сигнал —
узкие соседние жанры (`DEEP_HOUSE` vs `TECH_HOUSE`) считаются несовпадающими, хотя
музыкально близки. Матчинг двухуровневый — точный термин остаётся как есть, поверх
добавлен семейный (по `GENRE_FAMILY`/`expandGenresToFamilies` из
`packages/db/src/genre-families.ts`, ~29 семейств: house, techno, trance, bass,
hiphop, rock, metal…):

- **Seed-фильтр** (старт волны с явным genre-чипом): жанр слушателя расширяется до
  всего семейства (`expandGenresToFamilies([seedGenre])`) — фильтр по `track_genres`
  (и фолбэк по `releases.genre`) матчит `ANY(...)` по семейству, не только по точному
  жанру. Слушатель выбрал чип «Dub Techno» → едет всё техно-семейство.
- **`genreScore`/`trackGenreOverlap`** (режим похожести): общий хелпер
  `genreOverlapTerm` — точное пересечение жанров кандидата и текущего трека
  (доля совпавших × 0.4); плюс семейный терм — **флэт-бонус 0.2** за факт
  принадлежности тому же семейству (булев `EXISTS(genre = ANY(семья))`, а не доля
  от размера семейства: семьи по 4–36 жанров схлопнули бы вес почти в ноль). Термы
  не суммируются — `GREATEST(точный, семейный)`, потому что точное совпадение всегда
  является и семейным (иначе один и тот же жанр считался бы дважды).
- **`tasteGenreScore`/`tasteGenreScoreSeed`** (профиль вкуса): тот же `genreOverlapTerm` —
  точный терм (доля × 0.4 в seed-режиме / × 0.25 в режиме похожести) и семейный
  флэт-бонус с половинным весом (0.2 / 0.125), `GREATEST`, семья считается от
  `taste.topGenres`.
- **`sessionGenreBoost`**: точное совпадение с закреплённым в сессии genre — полный
  буст 0.35; совпадение только по семейству — половина, 0.175. `CASE` с приоритетом
  точного условия — не суммируются.

Настроения (`mood`) семейств не имеют — только жанры.

### Тональность (Camelot)

`packages/core/src/services/musical-key.ts` парсит `track_audio.musical_key` (буквенная
запись `C#m`/`Dbmin` или Camelot `8B`), строит колесо квинт и возвращает
`keyMatchSets(raw)` → `{ exact: string[], neighbor: string[] }` — все написания точной
и соседних (параллельная/квинта вверх/вниз) тональностей. Кандидат сравнивается по
нормализованной строке (`lower`, без пробелов/дефисов) через `ANY(...)`.

### Redis-сессия волны

`apps/web/lib/wave-session.ts` — ключи `wave:served:{sessionId}` (ZSET, честный
анти-повтор за всю сессию — не только последние 5) и `wave:seed:{sessionId}` (hash,
mood/genre, закреплённые первым запросом с явным seed). TTL 6ч, как presence;
любая ошибка Redis → пустая сессия (волна не роняется, просто без анти-повтора).
`recentServedIds` (последние 5 из ZSET) используются для разнообразия артистов.
`sessionId` генерируется в браузере (`vire_wave_sid` в `sessionStorage`, не путать с
общим `vire_sid` из `lib/session-id.ts`, который используется для play-events/presence).
Каждый явный запуск волны (`controls.startWave`) пробует свежий кандидат-sid, но
записывает его в `sessionStorage` только **при успешном старте** (`tracks.length>0`) —
неудачный фетч не оставляет играющую (старую) волну без её собственного анти-повтора
sid; раньше sid ротировался до фетча и при неудаче становился сиротой.

### Пачки и анти-повтор

Запрос возвращает 1–5 треков (`count`, по умолчанию 3) за раз. Плеер дозапрашивает
буфер, когда в очереди волны остаётся ≤2 трека после текущего (`needsWaveFetch`,
не считая уже дозапрошенное), и передаёт `played` (последние ≤100 id очереди) вместе
с серверным `wave:served` — двойная защита от повтора. Долгая сессия волны без
ограничений растила бы очередь в памяти вплоть до вкладки: `capLiveQueue`
(`apps/web/lib/player/queue.ts`) режет её на 300 треков (`LIVE_QUEUE_LIMIT`), оставляя
окно перед текущим треком для `prev()`.

## Где код

- **Zod-схемы:** `packages/api-contracts/src/wave.ts` (`waveQuerySchema`,
  `waveTrackSchema`, `waveResponseSchema`, `PLAY_SOURCES`)
- **API:** `apps/web/app/api/v1/wave/route.ts` — rate limit 120 req/мин на IP
  (`lib/rate-limit.ts`), валидирует mood/genre по `ALL_MOODS`/`ALL_TRACK_GENRES`
- **SQL-подбор:** `packages/db/src/queries/wave.ts` (`getWaveTracks`, `visibleTrackWhere`,
  `getTrackMusicalKey`, `getArtistIdsForTracks`, `textArrayParam`)
- **Семейства жанров:** `packages/db/src/genre-families.ts` (`GENRE_FAMILY`,
  `expandGenresToFamilies`) — используется для семейного подматчинга жанрового сигнала
- **Профиль вкуса:** `packages/db/src/queries/taste.ts` (`getTasteProfile`)
- **Тональность:** `packages/core/src/services/musical-key.ts` (`parseMusicalKey`,
  `keySpellings`, `neighborKeys`, `keyMatchSets`)
- **Redis-сессия:** `apps/web/lib/wave-session.ts` (`getWaveSession`,
  `appendWaveServed`, `setWaveSessionSeed`)
- **Интеграция в плеер:** `apps/web/components/player/audio-engine.ts`
  (`growWaveBuffer`, `maybeFetchWaveBuffer`, `controls.startWave`/`stopWave`),
  `apps/web/lib/player/wave-buffer.ts` (`needsWaveFetch`, `fetchWaveTracks`)
- **UI запуска:** `apps/web/components/home/flow-block.tsx` +
  `components/home/wave-chips.tsx` (клиент) + `wave-chip-items.ts` (server-safe
  маппинг в чипы), `components/wave-start-button.tsx`
- **DB таблицы:** `tracks.status='READY'`, `track_audio` (`bpm`, `musical_key`),
  `track_moods`, `track_genres`, `releases.genre` (фолбэк, если у трека нет своих
  `track_genres`)

## Env-переменные

Не требуют отдельных переменных (использует общий `REDIS_URL`).

## Известные ограничения

- Алгоритм работает только с треками в статусе `READY` и вышедшими релизами
  (`visibleTrackWhere`: `PUBLISHED` либо `SCHEDULED` с прошедшей датой), активный артист.
- BPM и тональность заполняются вручную артистом или автоанализом воркера
  (`apps/worker`, см. `docs/features/tracks-and-releases.md`); без них соответствующий
  вес просто не участвует в скоринге.
- Анти-повтор — Redis (ZSET на сессию), не персистентная история; при недоступности
  Redis деградирует до stateless-выдачи (может повторить трек в рамках сессии).
- Разнообразие артистов считается только по последним 5 выданным трекам сессии, не
  по всей истории.
