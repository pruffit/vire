# Discovery через людей и вкус

Открытие новых артистов через два сигнала, которых раньше не было в продукте: кого
слушают ваши друзья и кто похож на артистов, которых слушаете вы (co-listen). Дизайн —
`docs/superpowers/specs/2026-07-28-discovery-people-taste-design.md`.

## Что делает

- **«Открытия для вас»** на главной (`/`), только авторизованным: до 12 карточек
  артистов с подписью-причиной. Секция не рендерится меньше чем при 4 кандидатах.
- **«Похожие артисты»** на странице артиста (`/artists/[slug]`), доступно и анониму:
  до 8 карточек. Блок не рендерится меньше чем при 3 кандидатах.
- Каждая карточка — существующий `ArtistCard` с подписью-причиной вместо обычного
  стата: «Слушают ваши друзья» / «Похоже на то, что вы слушаете» / «В вашем жанре».

## Сигналы и веса

`score = coListen·0.45 + tasteOverlap·0.35 + friendSignal·0.20`

- **coListen** — Jaccard по множествам слушателей артиста за 90 дней
  (`|listeners(A)∩listeners(B)| / |listeners(A)∪listeners(B)|`), порог ≥2 общих
  слушателя (одно пересечение на малой аудитории — шум, не сигнал).
- **tasteOverlap** — Jaccard по объединённому множеству жанров (расширены до семейств
  через `expandGenresToFamilies`) и настроений артиста/пользователя.
- **friendSignal** = `min(1, друзей_слушавших / 3)` — трёх друзей достаточно для
  максимума, дальше сигнал не растёт.

Причина карточки — по старшему сработавшему сигналу: `friends` → `similar` → `taste`.
На странице артиста сигнал `friends` не участвует (пользователь может быть аноним),
поэтому там подпись — только `similar`/`taste`.

## Композиция

`composeDiscovery` (чистая функция, `packages/core/src/music/discovery/services/discovery-scoring.ts`):
дедуп по артисту (оставляет лучший score), кап **1 карточка на источник похожести**
(`sourceArtistId`) — иначе вся выдача может оказаться «похоже на одного и того же
артиста», срез до лимита. На странице артиста кап отключён (`buildSimilarArtists`
передаёт `maxPerSource` равным размеру пула) — там кандидаты всегда происходят от
одного и того же исходного артиста, кап неприменим по построению.

## Кандидаты и кэш

`packages/db/src/queries/similarity.ts`:
- `getSimilarArtists(artistProfileId, limit)` — co-listen среди слушателей артиста +
  пересечение жанров/настроений с исходным артистом.
- `getDiscoveryCandidates(userId, limit)` — три источника: co-listen с топ-3
  артистами вкуса пользователя, артисты, слушаемые друзьями за 90 дней, артисты,
  совпадающие по жанрам/настроениям вкуса; исключены уже подписанные и уже
  прослушанные артисты.

Обе функции — под TTL-кэшем `createTtlCache` (10 минут, `@vire/core`): самопересечение
`play_events` — самый тяжёлый запрос в проекте, окно фиксировано 90 днями.

## Где код

- **Типы:** `packages/core/src/music/discovery/types/discovery.ts` (`DiscoveryReason`,
  `DiscoveryCandidate`, `RankedDiscoveryArtist`)
- **Ранжирование (чистые функции):** `packages/core/src/music/discovery/services/discovery-scoring.ts`
  (`friendSignal`, `tasteOverlapScore`, `scoreDiscoveryArtist`, `discoveryReason`,
  `composeDiscovery`)
- **Кандидаты (БД):** `packages/db/src/queries/similarity.ts`
- **Сшивка:** `apps/web/lib/discovery.ts` — `buildDiscovery(userId, limit)`,
  `buildSimilarArtists(artistProfileId, limit)`
- **Подпись-причина (UI):** `apps/web/lib/discovery-reason.ts` — `discoveryReasonLabel`
- **Секция на главной:** `apps/web/components/home/discovery-section.tsx`
  (`DiscoverySection`), подключена в `apps/web/app/(listener)/page.tsx` под `Suspense`
  рядом с секцией «Артисты»
- **Блок на странице артиста:** `apps/web/app/(listener)/artists/[slug]/similar-artists-section.tsx`
  (`SimilarArtistsSection`), встроен после «Релизы», до «Площадки»
- **Переиспользовано:** `components/artist-card.tsx` (карточка), `components/scroll-row.tsx`
  (горизонтальная лента с тач-свайпом), `components/listener/section.tsx` /
  `components/section-header.tsx` (заголовки — платформенный/темизированный артиста)

## Env

Не требуется (только `DATABASE_URL`).

## Ограничения / на будущее

- Разреженность: на небольшой аудитории co-listen часто пуст — вкус и друзья
  наполняют выдачу, пороги (2 слушателя, 3 друга) не дают шуму выглядеть сигналом.
- Без материализованных таблиц похожести — пересчёт по запросу с TTL-кэшем дешевле
  сопровождать при текущем объёме данных; если каталог вырастет, первый кандидат на
  вынос — co-listen (самый тяжёлый подзапрос).
- Без рекомендаций треков (закрыто волной) и без поимённых «кто из друзей слушает» —
  только агрегированный счётчик, чтобы не открывать новый канал утечки приватности
  поверх уже существующего `social_visibility`.
- Секции под `Suspense` с `.catch(() => [])` на выборке — сбой discovery не роняет
  ни главную, ни страницу артиста.
