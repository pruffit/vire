# План: мобильный плеер

Спека — `../specs/2026-09-01-mobile-player-rework.md`. Три среза, последовательно:
B зависит от A по контракту, C — от обоих.

## Найдено при разведке (определяет объём)

- `QueueTrack` (`apps/mobile/lib/player-store.ts:18`) несёт только `artistName` — ни id,
  ни slug артиста. Из плеера артист недостижим.
- `getSimilarArtists` (`packages/db/src/queries/similarity.ts:237`) есть, но HTTP-эндпоинта
  у неё нет: сейчас её зовёт только серверный компонент веба.
- **В мобилке нет экрана артиста.** Навигация знает `ReleaseDetail`, `PlaylistDetail`,
  `UserProfile` — артиста нет. Значит «похожие артисты» вести некуда.
- `AddToPlaylistSheet` (`apps/mobile/components/add-to-playlist-sheet.tsx`) уже написан и
  подключён в `track-action-sheet.tsx` — переиспользуем, не пишем заново.
- Тянущаяся стеклянная шторка уже отработана на стенде: `LabSheet`
  (`apps/mobile/screens/material-lab-elements.tsx`) — жест, троттлинг кадра, `GlassPanel`
  с выпуском под нижнюю кромку. Продуктовая шторка строится по этому образцу.

## Срез A — эндпоинт контекста трека

**Контракт** `packages/api-contracts/src/track-context.ts` + экспорт в `index.ts`:
`trackContextResponseSchema` = артист (`slug`, `name`, `avatarUrl`, `bio`) + `similar`
(массив: `slug`, `name`, `avatarUrl`).

**Роут** `apps/web/app/api/v1/tracks/[trackId]/context/route.ts`. Внутри — query-функции
напрямую (чтение, не мутация: сервис и репозиторий не заводить, `CLAUDE.md` §Слои).
Нужна связка трек → артист: смотреть `packages/db/src/queries/` на предмет готовой; если
нет — дописать query-функцию рядом с существующими, не в сервис.

Имя сегмента — `[trackId]`, как у соседей (`like`, `manifest`, `lyrics`), иначе
`check:routes` валит сборку.

Тест роута рядом (`route.test.ts`) по образцу соседних: 404 на несуществующий трек,
форма ответа, скрытый артист.

**Гейты среза:** `pnpm --filter @vire/web typecheck`, `check:routes`, `check:contracts`,
`pnpm --filter @vire/web test`.

## Срез B — мини-плеер

`apps/mobile/components/mini-player.tsx`, только стили и, если понадобится, кнопка.

- `progressTrack`/`progressFill`: высота 1.5 → 3, `borderRadius` остаётся `radii.full`,
  `right: INSET` → отступ, равный левому краю текстовой колонки, чтобы полоса не доходила
  до кромки стекла. Левый край уже `INSET + COVER + space.md`.
- Проверить кнопку play/pause: площадь нажатия `layout.touchTarget`, попадание в
  концентрию панели, зазор до правой кромки — привести к тому же отступу, что и прогресс.

Правки только визуальные; жесты панели не трогать.

## Срез C — фуллскрин

### C1. Экран артиста

`apps/mobile/screens/artist-screen.tsx` — минимальный: аватар, имя, био, релизы.
Данные — существующий `/api/v1/artists/[slug]/page` (проверить контракт
`packages/api-contracts/src/artist-page.ts`). Регистрация в `home-stack.tsx` и
`search-stack.tsx` (там же, где `ReleaseDetail`), тип в `MainTabsParamList`.

### C2. Стеклянная шторка

`apps/mobile/components/player/player-sheet.tsx` — по образцу `LabSheet`:
`GlassPanel` + `Gesture.Pan` + `useFrameThrottle` (`apps/mobile/lib/frame-throttle.ts`).
В покое видна ручка; тянется до полного экрана; внутри — вертикальный скролл.

Обязательно: высота меняет геометрию стекла, поэтому значение жеста гасить до одного
на кадр — без этого шторка едет ступенями (разбор — `docs/vireglass/material-lab.md` E-43).

### C3. Содержимое шторки

Секции сверху вниз, каждая — отдельный компонент в `components/player/`:

1. Текст — переиспользовать `LyricsSection` из `panels.tsx`, **убрав пустое состояние**:
   нет строк → секция не рендерится вовсе (вернуть `null`), заголовка тоже нет.
2. «В плейлист» — строка, открывающая `AddToPlaylistSheet`.
3. «Об авторе» — из ответа среза A; тап ведёт на `Artist`.
4. «Похожие артисты» — горизонтальная лента из ответа среза A; переиспользовать
   `ScrollRow`-подобный паттерн, если в мобилке есть готовый; тап ведёт на `Artist`.
5. «Дальше» — существующий `QueueSection`.

`TrackSection` и `SectionDivider` из плеера убрать (спека §Что строим).

### C4. Раскладка экрана

`apps/mobile/screens/player-screen.tsx`: вместо `Animated.ScrollView` с двумя экранами —
фиксированный первый экран (обложка · заголовок · транспорт) и шторка поверх него.
`Transport` остаётся сиблингом `Backdrop` (цель преломления не может быть предком стекла).

Сохранить: иммерсивный режим обложки, `pushSheet`/`popSheet`, `TrackActionSheet` на
долгое нажатие, волну со скраббером.

**Гейты среза:** `pnpm --filter @vire/mobile typecheck`, `pnpm --filter @vire/mobile test`,
`pnpm turbo run check:layers`.

## Порядок и модели

A → B → C, последовательно (лимит подписки). Реализация — Sonnet по этому плану;
самокритика среза C — отдельным свежим агентом, там больше всего площади.

## Риски

- **Шторка над `Backdrop`.** Стекло не может быть потомком своей цели преломления. Шторка
  обязана быть сиблингом `Backdrop`, как уже сделан `Transport`, иначе RenderThread падает
  рекурсией RenderNode.
- **Бюджет поверхностей.** На экране уже транспорт; шторка — вторая. Замер устройства:
  цена поверхности ≈ 0.8 мс GPU, три держатся с запасом
  (`docs/vireglass/benchmarks/2026-08-31-device-after-capture-fix.md`). Две — в норме.
- **Экран артиста** может оказаться шире, чем кажется, если контракт страницы артиста
  тянет много блоков. Брать минимум: шапка и релизы.
