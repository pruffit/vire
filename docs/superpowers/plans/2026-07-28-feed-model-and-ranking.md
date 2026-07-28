# План: лента — состав и ранжирование

Дизайн — `docs/superpowers/specs/2026-07-28-feed-model-and-ranking-design.md`.
Два среза: A (данные + ранжирование), B (UI секции).

## Срез A — кандидаты и ранжирование

### A1. Чистое ранжирование (`packages/core/src/services/feed-ranking.ts`)
Образец стиля — `packages/core/src/services/wave-scoring.ts` (константы + чистые функции).
- типы `FeedItemKind`, `FeedReason`, `FeedCandidate`, `RankedFeedItem` — в
  `packages/core/src/types/feed.ts`;
- `recencyScore(ageDays, halfLifeDays)`, `affinityScore(candidate, taste, followedArtistIds)`,
  `popularityScore(plays30d)`, `scoreFeedItem(candidate, ctx)` — по формулам и весам из спеки;
- `composeFeed(candidates, opts)` — сортировка, кап 2 на артиста, квота 30% малым
  (ниже медианы `plays30d`), дедуп, срез до `limit`;
- экспорт из `packages/core/src/index.ts`.
- Тесты: свежесть убывает монотонно; affinity берёт максимум, а не сумму; популярность
  насыщается (в 100 раз больше прослушиваний ≠ в 100 раз выше score); кап на артиста
  соблюдён; квота малым выполняется, когда такие кандидаты есть, и не ломает выдачу,
  когда их нет; пустой вход → пустой выход.

### A2. Кандидаты (`packages/db/src/queries/feed.ts`)
- `getFeedCandidates(userId, limit = 120): Promise<FeedCandidate[]>` — четыре под-выборки
  из спеки (релизы подписок; релизы артистов вкуса + по жанрам/настроениям; анонсы
  подписок за 30 дней; скорые релизы подписок) + один агрегат `plays30d` по собранным
  id релизов. Никаких подзапросов на строку.
- `getFeed` оставить до перехода UI, затем удалить вместе с его экспортом (проверить
  вызывающих `grep`).
- Грабли: дата считается в SQL (`now() - interval '30 days'`), колонки в `sql`-шаблонах
  внутри `.select()` не интерполировать.
- Профиль вкуса — существующий `getTasteProfile`, подписки — существующие таблицы.
- Тесты `packages/db` — по образцу соседних (если для queries тестов нет, ограничиться
  core-тестами и route/UI-тестами).

### A3. Сшивка
- `apps/web/lib/feed.ts` — тонкая функция `buildFeed(userId, limit)`: кандидаты из `@vire/db`
  → `composeFeed` из `@vire/core` → готовый массив для секции; добивка свежими
  (`listReleases({ sort: 'fresh' })`) при < 6 элементов, `reason: 'fresh'`.
- Тест на добивку и на то, что пустой результат не роняет секцию.

## Срез B — UI секции «Ваша лента»

- `apps/web/components/home/feed-section.tsx` (новый) — серверный список карточек:
  три вида элемента + подпись-причина; переиспользовать `ReleaseQuickLook`,
  `CountdownBadge`/`UpcomingPresaveButton`, аватар артиста (`ArtistCard`/`ChatAvatar` —
  выбрать существующий, не писать новый), `Section` из `components/listener/section`.
- Клиентский разворот «Показать ещё» (12 → 24) без второго запроса — маленький
  клиентский компонент-обёртка, состояние `useState<number>`.
- `home-sections.tsx`: `FeedSection` переключается на `buildFeed`; заголовок «Ваша лента».
- `page.tsx`: секция остаётся под `Suspense`, для анонимов не рендерится (как сейчас).
- Мобилка: одна колонка, тач-таргеты 44px, никаких горизонтальных скроллов в карточке.
- Тесты: рендер трёх видов карточек, подпись-причина, «Показать ещё» раскрывает остаток.

## Документация
- `docs/features/` — новый файл `feed.md` (состав, сигналы и веса, защита малых артистов,
  холодный старт, где код).
- `docs/roadmap/stage-2.md` §4.2/§4.3 → ✅ со ссылкой на дизайн-доку и фичедок; убрать
  §4.2–4.3 из «требуют обсуждения» с пометкой, что развилки закрыты автономно 28.07.
- `CLAUDE.md` — упомянуть ленту в списке публичных страниц (одна строка, не раздувать).

## Гейты
`@vire/core typecheck` · `@vire/core test` · `@vire/db typecheck` · `@vire/web typecheck` ·
`lint` · `check:routes` · `test` · `audit:design` · `build`.
