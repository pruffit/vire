---
name: vire-loop
description: Use at the START of any non-trivial Vire task — new feature, behavior change, multi-file refactor, or bug fix. The Vire engineering loop (Requirements→Design→Implementation→Testing→Ship) that drives the work through Superpowers phase-skills, injects Vire's own rules/gates/review-checklist at each phase, and routes cheap models to mechanical work so Opus is spent only on judgment. Skip ONLY for true one-liners (typo, rename, copy tweak).
version: 1.0.0
user-invocable: true
---

# Vire — инженерный цикл (оверлей над Superpowers)

Superpowers задаёт **КАК** (дисциплина фаз). Этот скилл вкручивает **ЧТО ИМЕННО**
для Vire: артефакты, гейты, роутинг моделей и review-чеклист из накопленного фидбэка.
Не дублирует Superpowers — подключает его на каждой фазе.

## Триаж (первое решение)

- **Тривиалка** (опечатка, переименование, правка копирайта, одно-строчный фикс) → быстрый путь: правка → гейты → коммит. Цикл не разворачивать.
- **Иначе** (фича, смена поведения, рефактор >1 файла, нетривиальный баг) → полный цикл ниже. «Это же просто» — красный флаг, см. таблицу.

## Цикл и привязка фаз

| Фаза | Skill (Superpowers) | Vire-инъекция | Артефакт | Модель |
|---|---|---|---|---|
| Requirements/Design | `superpowers:brainstorming` | дёрнуть `vire-architecture` (слои/FSD) до дизайна; продумать **мобилку** и **переиспользование** уже здесь | spec в `docs/superpowers/specs/` | Opus (главная сессия) |
| План | `superpowers:writing-plans` | точные пути; что переиспользуем из `packages/ui` и `apps/web/components`; какой слой; какие тесты | план в `docs/superpowers/plans/` | Opus |
| Implementation | `superpowers:subagent-driven-development` + `superpowers:test-driven-development` | сабагентам — ссылки на `vire-architecture/media/queues`, не инлайнить файлы | код + тесты | **Sonnet** (Haiku — тривиал/поиск/маппинг) |
| Debug (если всплыл) | `superpowers:systematic-debugging` | gotchas Vire (см. ниже) | — | Opus |
| Review | `superpowers:requesting-code-review` | **Vire-чеклист** (ниже) обязателен | вердикт | Sonnet (Opus если спорно) |
| Testing/Verify | `superpowers:verification-before-completion` | прогон ВСЕХ гейтов (ниже), Iron Law | зелёные гейты | механика |
| Ship | `superpowers:finishing-a-development-branch` | версия в 2 местах, lockfile, doc фичи | коммит/PR | — |

## Роутинг моделей (главный рычаг по токенам)

Диспетчишь сабагента (`Agent` tool, поле `model`) — выбирай по характеру работы, НЕ по умолчанию Opus:

- **Opus** — суждение: Requirements, Design, план, нетривиальный дебаг, спорное ревью.
- **Sonnet** — механика по готовому плану: реализация, обычное ревью, рутинные тесты.
- **Haiku** — структурный труд: поиск по коду, маппинг файлов, тривиальные правки/переименования.

Принцип: план уже содержит рассуждение — исполнение это имплементация. Не жги Opus на то, что описано пошагово.

## Vire review-чеклист (закрывает реальные промахи)

Прогоняй перед тем как сказать «готово». Каждая мысль слева = СТОП, ты рационализируешь:

| Мысль-самооправдание | Реальность |
|---|---|
| «десктоп готов» | Проверил **мобильную вёрстку**? Узкий вьюпорт, горизонтальный скролл таблиц, сайдбар→топбар. |
| «напишу компонент» | Сначала поиск готового в `packages/ui` и `apps/web/components`. Не плодить дубли — выноси общее. |
| «быстро добавлю стили» | `min-h-screen`/`h-screen` на странице/лейауте ЗАПРЕЩЕНЫ (ломают app-shell). Высоту даёт скролл-область. |
| «вынесу в useEffect/новый стейт» | Утечки, лишние ререндеры/реконсиляция, мемоизация, кеш — следи по умолчанию. |
| «поясню комментом» | Минимум комментов. Только неочевидное «почему», не «что». |
| «дизайн потом» | Принципы Impeccable применяются по умолчанию; при UI — `audit:design` обязателен. |

## Vire gotchas (помнить в дебаге/реализации)

- Не интерполируй JS-`Date` в raw-`sql` Drizzle — считай дату в SQL (`now() - interval '7 days'`).
- Не интерполируй колонку в `sql` внутри `.select()` — ссылайся литералом на внешнюю таблицу.
- Роль/имя/аватар кладутся в JWT при логине — после смены нужен релогин.
- Трекам нельзя ставить READY руками — без воркера нет HLS (маркер `!hls`).

## Verify-контракт (Iron Law: нет «готово» без свежего прогона)

Никаких claim'ов «работает/готово» без вывода этих команд в текущем сообщении:

```bash
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design   # если трогали UI
pnpm --filter @vire/web build
```

## Ship

- Версия в ДВУХ местах: корневой `package.json` (тег) + `apps/web/package.json` (UI).
- Менял `package.json` → `pnpm install` → коммит lockfile → только потом тег.
- Новая фича не готова без файла в `docs/features/`.
