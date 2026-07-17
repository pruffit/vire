# §7.2 — качество и разнообразие editorial-подборок

Дата: 2026-07-17. Скоуп: `packages/db/src/queries/editorial*.ts`, `popularity.ts`.
UI, воркер, расписание, схема БД — не меняются.

## Диагноз (что не так сейчас)

- **P1. RELISTEN измеряет не возвраты.** `generateRelistenPlaylist` группирует
  `play_events` только по треку и считает `COUNT(DISTINCT DATE(started_at))` по
  всем слушателям вместе: популярный трек, который каждый день слушают *разные*
  люди, проходит порог «2+ дня». Анонимы (`user_id IS NULL`) исключены, хотя
  фичедока обещает учёт по `session_id`.
- **P2. Дыры видимости.** RELISTEN не джойнит tracks/releases вообще — скрытый
  артист (`isActive=false`), заблокированный или удалённый из публичного релиза
  трек может попасть в подборку. FRESH проверяет READY + публичность релиза, но
  не `artistProfiles.isActive`.
- **P3. Нет разнообразия по артистам.** Ни подлинные совпадения, ни филлер не
  ограничены по артисту: свежий альбом на 12 треков занимает половину FRESH
  подряд; на тонком каталоге один артист доминирует во всех карточках.
- **P4. Личные подборки ранжируются глобальной популярностью.** Сила совпадения
  не учитывается (mood И жанр = как «хоть что-то одно»), `topArtistIds` из
  профиля вкуса вообще не используется. «Для тебя» — глобальный топ,
  отфильтрованный по mood/genre.

Вне скоупа (осознанно): тематический филлер mood-подборок (добивка остаётся
генериком из общего пула — полная карточка важнее темы хвоста), ротация
`randomWeight`, новые виды подборок (по любимым артистам), diff-пересборка личных.

## Решение

### 1. `composePlaylist` — artist cap как чистая политика (P3)

`editorial-policy.ts`: новый тип `PlaylistCandidate = { trackId, artistId }` и
функция, заменяющая `fillToLimit`:

```ts
composePlaylist(
  genuine: PlaylistCandidate[],
  pool: PlaylistCandidate[],
  avoid?: ReadonlySet<string>,
  limit = PLAYLIST_LIST_LIMIT,   // 25
  maxPerArtist = MAX_PER_ARTIST, // 3
): string[]
```

Семантика (приоритет убывает):
1. `genuine` в исходном порядке, но артист сверх cap **откладывается**, не
   выбрасывается;
2. отложенный хвост `genuine` (cap снят) — подлинное совпадение всегда важнее
   филлера;
3. `pool` вне `avoid` с тем же cap (cap считается по уже собранному списку);
4. `pool` вне `avoid` без cap;
5. `pool` из `avoid` (переиспользование занятого — только когда пул исчерпан).

Дедуп по trackId на всех шагах. Инварианты: genuine никогда не вытесняется
филлером; выдача короче `limit` только когда genuine+pool физически меньше;
существующее поведение `avoid` (usedFiller/exclude) сохраняется.
`fillToLimit` и его тесты удаляются, все 6 колл-сайтов переводятся на
`composePlaylist`. `markFiller` продолжает работать по границе
`genuine.length` (число уникальных genuine после дедупа — возвращать её из
композиции или считать на месте, решает исполнитель, зафиксировать тестом).

### 2. RELISTEN: возвраты слушателя + видимость (P1, P2)

Слушатель = `COALESCE(user_id::text, session_id)`. Внутренний агрегат по
(слушатель, трек) за 30 дней с `HAVING COUNT(DISTINCT DATE(started_at)) >= 2`,
внешний — число таких вернувшихся слушателей на трек, сортировка по нему.
Кандидаты джойнятся на `tracks/releases/artist_profiles` с `visibleTrackWhere`
(и `artistId` в выдаче). FRESH переводится с локального `releaseIsPublic` на
`visibleTrackWhere` (добавляется join `artist_profiles`); локальный
`releaseIsPublic` после этого не нужен — удалить.

### 3. Персональное ранжирование по силе совпадения (P4)

`selectTrackIdsByTaste(moods, genres, affinityArtistIds?)` начинает возвращать
кандидатов и ранжировать по `matchScore DESC`, затем прежний
`popularityScoreSql(30) DESC`, затем свежесть:

```
matchScore = (moodMatch ? 1 : 0) + (genreMatch ? 1 : 0)
           + (artistProfileId = ANY(affinityArtistIds) ? 2 : 0)
```

Веса — `sql.raw`-литералы (грабли Drizzle: bind-параметры в CASE Postgres
типизирует криво). Вызовы:
- «Для тебя»: `(taste.topMoods, taste.topGenres, taste.topArtistIds)` — трек
  любимого артиста, совпавший и по mood, и по жанру, поднимается наверх;
- личные mood-подборки: `([mood], [], taste.topArtistIds)`;
- общие MOOD: `([mood], [], [])` — matchScore константен, порядок остаётся
  популярностным (поведение общих не меняется).

### 4. artistId в кандидатах

`topTrackIdsByPlays` (используется только editorial) меняет сигнатуру на
`Promise<PlaylistCandidate[]>`; `getFillerPool`, FRESH- и RELISTEN-запросы
добавляют `releases.artistProfileId` в select. Пороги `MIN_TRACKS` /
`hasEnoughTracksForPersonalPlaylist` по-прежнему считаются от числа подлинных
кандидатов до композиции.

## Тесты

Чистые юнит-тесты `editorial-policy.test.ts` (Vitest, `pnpm --filter @vire/db test`):
- cap: артист с >3 треками в genuine — первые 3 в голове, остальные после
  других артистов, но до филлера;
- genuine не вытесняется: 25 genuine одного артиста → все 25 в выдаче;
- филлер уважает cap относительно уже собранного (включая genuine);
- приоритет avoid: незанятый пул раньше занятого, занятый — только при
  исчерпании;
- дедуп genuine∩pool; limit больше суммы — выдача короче; кастомный limit.

SQL-изменения (RELISTEN/FRESH/matchScore) юнитами не покрываются (в репо нет
интеграционных БД-тестов) — проверка: typecheck + ручной прогон
`POST /api/v1/admin/editorial` на локальной базе при верификации.

## Документация и ship

- `docs/features/curated-playlists.md`: новая семантика RELISTEN, artist cap,
  affinity-ранжирование личных, `composePlaylist` вместо `fillToLimit`.
- `docs/roadmap/stage-2.md`: §7.2 → ✅, обновить сводку.
- Версия в двух package.json, коммит без тега (деплой — по команде).
