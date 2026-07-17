# План: хвосты §9 + §10.4 (спека `2026-07-17-admin-tails-blacksky-design.md`)

Три независимых пакета, выполняются последовательно (общее дерево, общие гейты).
После каждого пакета: гейты (typecheck web/core/db, lint, check:routes, test,
audit:design при UI, build в конце пачки) + отдельный коммит.

## Пакет A — §10.4 «чёрное небо» (самый маленький, первым)

1. `apps/web/lib/black-sky.ts` — `blackSkyProgress(now: Date): number` (эпоха
   2026-01-11Z, `100*(1-exp(-days/500))`, дневной джиттер ±0.4% от hash YYYY-MM-DD,
   clamp [0.1, 99.9]).
2. `apps/web/lib/black-sky.test.ts` — детерминизм; рост между месяцами; границы;
   дата до эпохи.
3. `app/fwqa688/page.tsx` — блок прогресса под бегущей строкой: сегментированный
   бар (CSS transition width на маунте, без infinite transform-анимаций), mono
   `NN.NNNN%` tabular-nums, редкий глитч цифр по существующему setInterval-паттерну.
4. `docs/features/easter-eggs.md` — новый док (Konami, дождь иконок, /fwqa688, формула).

## Пакет B — §9.1 тема артиста в админке

1. Вынести `apps/web/components/theme-editor.tsx` из `edit-profile-form.tsx`
   (THEME_PRESETS, FontGrid, превью; controlled `ThemeValue`/`onChange`).
   Дашборд-форма — на общий компонент, контракт FormData не меняется
   (регресс-проверка: имена полей bg/text/accent/grain/fontSans/fontMono в fd).
2. `packages/db` queries/admin.ts: `getArtistCore` + `themeTokens`;
   `adminUpdateArtist` + опциональный `themeTokens` в `.set()`.
3. `packages/core` artist.ts: `adminUpdate` + `theme?`, строгая валидация
   (hex ×3, шрифты по deps.fonts). Тесты в artist.test.ts (4 кейса из спеки).
4. `apps/web/app/admin/actions.ts`: расширить input, fonts-deps из font-catalog.
5. `admin/artists/[id]/edit/*`: страница max-w-5xl + grid, форма с ThemeEditor,
   state темы, submit шлёт theme; убрать фразу «темизация — в дашборде».
6. Мобилка: колонка на узком, превью не переполняется (min-w-0).
7. Обновить `docs/features/admin.md` (§ редактура) и `docs/features/artist-profile.md`
   при упоминании, что тема правится только в дашборде.

## Пакет C — §9.3 история метрик

1. `packages/db/src/schema/` — таблица `platform_metrics_daily` (см. спеку);
   `pnpm --filter @vire/db db:generate` → миграция 0034; в кастомный SQL миграции —
   бэкфил (generate_series + кумулятивные counts по created_at, plays/listeners из
   play_events). Не интерполировать JS-Date в raw sql — только SQL-выражения дат.
2. `packages/db/src/queries/metrics.ts`: `snapshotPlatformMetricsDaily(day: string)`
   (INSERT … ON CONFLICT DO UPDATE, идемпотентно) и
   `getPlatformMetricsHistory(days: number)`. Экспорт в index.ts.
3. `packages/core`: константа `QUEUE_METRICS = 'metrics-daily'` рядом с QUEUE_EDITORIAL.
4. `apps/worker`: `workers/metrics.worker.ts` (тонкий: `yesterdayMsk(now)` чистая →
   snapshot); `index.ts` — воркер + upsertJobScheduler `10 0 * * *` Europe/Moscow +
   алерты по образцу; `yesterdayMsk` — в `lib/` с vitest-тестом (переход суток/года,
   TZ-независимость от локали хоста).
5. `/admin/analytics/page.tsx`: секция «История платформы» — кривые users/likes_total/
   follows_total из `getPlatformMetricsHistory`; табы-ссылки `?days=30|90|180`
   (searchParams, дефолт 30); общий локальный чарт-компонент вместо трёх копий
   DailyChart-паттерна. Пустая таблица (день 1) → EmptyState.
6. `docs/features/platform-metrics.md`.

## Гейты (verify-контракт)

```bash
pnpm --filter @vire/web typecheck && pnpm --filter @vire/core typecheck && pnpm --filter @vire/db typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/worker test   # пакеты C (и A не трогает worker)
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```

## Ship

- Три коммита (по пакету), без пуша/тега (по команде).
- Самокритика отдельным сабагентом после всех трёх пакетов, до финального отчёта.
