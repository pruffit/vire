# Срез 7 — Дашборд артиста + плотность: план реализации

Спека: `../specs/2026-07-26-mobile-slice-7-dashboard-density-design.md`. Одна сессия-реализатор
(Sonnet), последовательно — общие слои (fieldClass/SideNav/ColorField) правим ПЕРВЫМИ, потом
потребителей. Затем самокритика (Sonnet), фиксы, гейты, коммит.

Все правки — `pointer-coarse:` или mobile-only. Десктоп-плотность/вид НЕ менять. App-shell
неизменен (`min-h-screen`/`h-screen` запрещены). Перед правкой файла — прочитать целиком.
Общие хелперы — `touchPill`/`touchTargetClass` из `components/popover.tsx` (не литералы).

## Задача B — отступы контейнеров (14 файлов)

В каждом заменить `px-5 sm:px-6 lg:px-8` → `px-4 sm:px-6 lg:px-8` (только базовый мобильный
класс; `sm:`/`lg:` не трогать). Файлы (строка-ориентир):
- `app/(listener)/page.tsx`, `artists/page.tsx`, `artists/loading.tsx`, `artists/[slug]/page.tsx`,
  `artists/[slug]/releases/[releaseId]/page.tsx`, `.../tracks/[trackId]/page.tsx`,
  `releases/page.tsx`, `search/page.tsx`, `library/page.tsx`, `library/liked/page.tsx`,
  `profile/page.tsx`, `u/[userId]/page.tsx`, `friends/page.tsx`, `playlists/[id]/page.tsx`.
Проверить grep'ом, что после правки не осталось `px-5 sm:px-6 lg:px-8` в (listener) и что
нигде не задет full-bleed hero (padding у него не менялся — hero вне контейнера).

## Задача A1 — базовый инпут-слой `fieldClass`

`components/ui-kit.tsx` (~строка 27) — в `fieldClass` добавить `pointer-coarse:min-h-11`.
НЕ трогать `selectClass` (инлайн-контролы админ-таблиц, компактный контекст). Проверить,
что `fieldClass` используется для input/textarea/select и `min-h-11` их не ломает (textarea
уже растёт — min-h безопасен). Убедиться, что триггеры `Select`/`DateField`, если используют
`fieldClass`, подхватят фикс; если у них свой класс — добавить `pointer-coarse:min-h-11` там же.
Прочитать `components/select.tsx` и `components/date-field.tsx` — подтвердить.

## Задача A2 — `SideNav`

`components/side-nav.tsx` (~строка 44–46) — к классу пункта добавить `pointer-coarse:min-h-11`.
Проверить: не ломает десктоп (десктоп-раскладка под `md:`, coarse на десктопе не срабатывает);
listener-сайдбар (`collapsed`) — тоже ок (на мобилке он `hidden md:flex`, не виден). Выравнивание
`inline-flex items-center` уже есть — min-h просто задаёт высоту.

## Задача A3 — `ColorField` (live color picker)

`components/color-field.tsx`:
- Свотч-триггер (~174, `h-8 w-8`) → добавить `pointer-coarse:h-11 pointer-coarse:w-11`.
- Hue-слайдер (~217, `h-3`) → `pointer-coarse:h-5` (проще палец); хэндл (~224) при необходимости
  крупнее на таче.
- SV-квадрат `h-32` — оставить (крупный).
- Hex-инпут (~185, `px-2 py-1 text-xs`) → `pointer-coarse:min-h-11`.
Попап overflow чинится в ThemeEditor (A3b), не тут (попап `left-0` корректен при full-width поле).

### A3b — `ThemeEditor` цвет-грид
`components/theme-editor.tsx` (~144, `grid grid-cols-2 gap-4` для bg/text цветов) →
`grid grid-cols-1 sm:grid-cols-2 gap-4`. На мобилке поля цвета стекаются, попап `w-56`
влезает в full-width поле (~288px на 320-экране с `px-4`). Десктоп (`sm+`) — прежние 2 колонки.

## Задача A4 — `TrackManager`

`app/dashboard/releases/[id]/track-manager.tsx`:
- Grip-хендл (~329, `h-9 w-7`) → `pointer-coarse:h-11 pointer-coarse:w-11` (или `touchTargetClass`
  с сохранением визуала — на выбор реализатора, важно 44px хит-зона на таче).
- Кнопки «параметры»/«удалить» (~385, ~400, `size-9`) → `pointer-coarse:size-11`.
- Reanalyze (~476, `size-6`) → `touchTargetClass('sm')`.
- Инпут тональности (~467, `px-2 py-1 text-xs`) → `pointer-coarse:min-h-11`.
DnD-реордер не переделываем (кнопки вверх/вниз — бэклог), только увеличиваем хит-зону grip.

## Задача A5 — вложенные пикеры

- `components/genre-picker.tsx` — пилюли (~116, ~135, ~212) → `touchPill`; поиск-инпут (~167)
  → `pointer-coarse:min-h-11`; reanalyze (~146) → `touchTargetClass('sm')`.
- `components/mood-picker.tsx` — пилюли (~88) → `touchPill`.
- `components/credits-editor.tsx` — remove (~153, `size-7`) → `touchTargetClass('sm')`;
  роль-пилюли (~170) → `touchPill`; поле имени (~147) — если `fieldClass`, уже покрыто A1.

## Задача A6 — точечные CTA

- `app/dashboard/publish-button.tsx` (~69, `text-xs px-2.5 py-1`) → `pointer-coarse:min-h-11`.
- `app/dashboard/releases/[id]/delete-release-button.tsx` (кнопки ~52/78/86) → `pointer-coarse:min-h-11`.
- `components/lyrics-editor.tsx` (~59, «Сохранить текст») → `pointer-coarse:min-h-11`.
- `app/dashboard/posts/posts-manager.tsx` (~186/196/227/234/244) — кнопки → `pointer-coarse:min-h-11`.
- `components/links-editor.tsx` (~125–133, remove-иконка) → `touchTargetClass('sm')`.

## Тесты

Правки визуальные/классовые — новых тестов не требуется; существующие не должны сломаться.
`fieldClass`/`ColorField`/`ThemeEditor` — если есть связанные тесты, прогнать зелёными.

## Документация

`docs/features/mobile-patterns.md`:
- в «Где код» — отметить `fieldClass`/`SideNav`/`ColorField` тач-таргеты.
- новый подраздел «Дашборд артиста + плотность (Срез 7)»: `fieldClass` 44px, SideNav,
  ColorField (свотч/hue/попап-стек), трек-редактор/пикеры, отступы `px-4` mobile-only
  (контент выровнен с навом/дашбордом).

## Гейты (Iron Law)

```
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```
