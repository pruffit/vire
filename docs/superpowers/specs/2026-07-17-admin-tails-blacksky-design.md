# Спека: хвосты §9 (тема артиста, история метрик) + §10.4 «чёрное небо»

Дата: 2026-07-17. Пачка из трёх независимых задач бэклога stage-2.

## Задача 1 — §9.1-хвост: тема артиста в админ-редакторе

**Что.** `/admin/artists/[id]/edit` умеет править `theme_tokens` (bg/text/accent/grain/
fontSans/fontMono) минуя ownership-гард — как остальные админ-поля.

**Переиспользование (ключевое решение).** Секция «Тема страницы» из
`apps/web/app/dashboard/profile/edit-profile-form.tsx` (пресеты + ColorField'ы + грейн +
FontGrid'ы + живое превью) выносится в общий клиентский компонент
`apps/web/components/theme-editor.tsx`. Дашборд-форма переводится на него без изменения
контракта FormData (`bg/text/accent/grain/fontSans/fontMono` остаются в форме — ColorField
и hidden-инпуты FontGrid уже дают имена). Админ-форма читает значения из state и шлёт
типизированный input в server action.

**Контракт ThemeEditor (controlled):**
```ts
interface ThemeValue { bg: string; text: string; accent: string; grain: boolean; fontSans: string; fontMono: string }
ThemeEditor({ value, onChange, artistName, avatarUrl, disabled }: {
  value: ThemeValue; onChange: (v: ThemeValue) => void;
  artistName: string; avatarUrl: string | null; disabled?: boolean;
})
```
THEME_PRESETS и FontGrid переезжают внутрь theme-editor.tsx. Превью — как в дашборде
(там оно завязано на avatarPreview; в общем компоненте — просто `avatarUrl`; дашборд
передаёт свой blob-превью).

**Серверная часть.**
- `getArtistCore` (packages/db/queries/admin.ts) дополняется `themeTokens` (jsonb → ThemeTokens).
- `ArtistService.adminUpdate` — input получает опциональный
  `theme?: { bg; text; accent; grain; fontSans; fontMono }`. Валидация **строгая**
  (в отличие от updateProfile с fallback): невалидный hex → ValidationError; шрифт вне
  `deps.fonts` → ValidationError (если deps.fonts не передан — шрифты принимаются как есть,
  как в resolveFont-семантике недоступного каталога; в web deps передаётся всегда).
- `adminUpdateArtist` (db) — `themeTokens` в `.set()` при наличии.
- `actionAdminUpdateArtist` — расширить input, собрать сервис с
  `fonts: { sans: SANS_FONTS, mono: MONO_FONTS }` из `@/lib/font-catalog`.

**UI админки.** В `artist-edit-form.tsx` — секция «Тема страницы» (ThemeEditor) под
базовыми полями; контейнер страницы расширить `max-w-2xl → max-w-5xl`, на lg — двухколоночная
сетка (базовые поля | тема), на мобилке — колонка. Убрать из подписи внизу слова про
«темизация — в дашборде».

**Тесты.** packages/core: adminUpdate с темой — валидная тема сохраняется; невалидный hex →
ValidationError; шрифт вне каталога → ValidationError; вызов без theme не трогает themeTokens.

## Задача 2 — §9.3-хвост: персистентная история метрик

**Зачем персистентность.** Тоталы (users/likes/follows/…) невосстановимы задним числом:
unlike/unfollow/удаление стирают строки; presence вообще живёт в Redis. Снимаем ежедневный
снапшот в Postgres — история переживает удаления и возможную чистку play_events.

**Схема.** Миграция 0034: таблица `platform_metrics_daily`:
```
day date PK
users int, artists int, releases_published int, tracks_ready int,
plays int, listeners int,            -- за этот день (из play_events)
likes_total int, follows_total int, playlists_total int, posts_total int
```
Бэкфил в кастомном SQL миграции: generate_series от min(created_at по users) до вчера,
кумулятивные counts по created_at (users/artist_profiles/releases/tracks/playlists/posts/
liked_tracks/follows — приближённо: удалённые лайки/подписки не восстановить, это принятая
погрешность) + plays/listeners по дням из play_events. Точные имена таблиц/колонок сверить
со схемой (`packages/db/src/schema/*`).

**Снапшот-джоба.** Новая очередь `QUEUE_METRICS = 'metrics-daily'` (константа в
`packages/core` рядом с QUEUE_EDITORIAL). В `apps/worker/src/index.ts` —
`upsertJobScheduler('metrics-daily', { pattern: '10 0 * * *', tz: 'Europe/Moscow' })`.
Воркер тонкий: считает «вчера по МСК» чистой функцией (`yesterdayMsk(now: Date): string`,
покрыть тестом) и зовёт `snapshotPlatformMetricsDaily(day)` из `@vire/db` — один
`INSERT … ON CONFLICT (day) DO UPDATE` с подзапросами (идемпотентно, повторный прогон
безвреден). Алерты failed/error — по образцу соседних воркеров.

**Чтение и UI.** `getPlatformMetricsHistory(days): PlatformMetricsDay[]` в queries/admin.ts
(или queries/metrics.ts). `/admin/analytics`: секция «История платформы» — графики роста
из снапшотов: пользователи, лайки, подписки (кривые тоталов); существующий чарт
прослушиваний остаётся на play_events. Период — табы-ссылки `?days=30|90|180` (SSR через
searchParams, дефолт 30). Рендер — тот же бар/line-паттерн, что DailyChart (вынести общий
локальный компонент, не дублировать три раза).

**Док.** `docs/features/platform-metrics.md` (таблица, джоба, погрешность бэкфила, UI).

## Задача 3 — §10.4: прогресс-бар «чёрного неба» на /fwqa688

**Что.** На терминал-пасхалке появляется загадочный сегментированный прогресс-бар,
который **детерминированно** заполняется со временем (месяцы/годы), с лёгким дневным
джиттером (иногда «откатывается» — ARG-атмосфера).

**Формула** — чистая функция `blackSkyProgress(now: Date): number` в
`apps/web/lib/black-sky.ts`:
- эпоха: `2026-01-11T00:00:00Z` (загадочная константа);
- база: `100 * (1 - exp(-days/500))` (≈6% через месяц, ≈50% через год, асимптота к 100);
- джиттер: детерминированный hash от `YYYY-MM-DD` → ±0.4%;
- clamp [0.1, 99.9]; вернуть с точностью до 4 знаков.
Тест (vitest): детерминизм, монотонный рост по месяцам (джиттер меньше месячного прироста),
границы, до эпохи → минимум.

**UI** (в `app/fwqa688/page.tsx`, стиль страницы сохранить):
- mono-строка `[████░░░░░░░░] NN.NNNN%` или div-бар с CSS-transition заполнения от 0 до
  значения на маунте; подпись в духе терминала (`> готовность протокола`), tabular-nums;
- редкий глитч последних знаков через существующий setInterval-паттерн страницы;
- **запрещено**: бесконечные transform/opacity-анимации на постоянно видимых элементах
  (правило app-shell); заполнение — одноразовый transition.

**Док.** `docs/features/easter-eggs.md` — новый файл: Konami-попап, дождь иконок,
/fwqa688 + прогресс «чёрного неба» (что, где код, формула).

## Не-цели
- Никаких правок Этапа 2 / покупок.
- Не трогаем editorial-крон и play_events-пайплайн.
- Тема артиста в админке — без загрузки аватара/ссылок/видео (остаются в дашборде).
