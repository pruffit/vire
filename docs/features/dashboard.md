# Дашборд артиста (/dashboard)

## Что делает

Личный кабинет артиста. Доступен только пользователям с ролью `ARTIST`+.

### Разделы

**Релизы** (`/dashboard/releases`)
- Список релизов со статусами DRAFT/PUBLISHED/SCHEDULED (бейджи статусов из общего кита)
- Создание релиза: `/dashboard/releases/new`
- Редактирование: `/dashboard/releases/[id]` — название, обложка, liner notes, credits, жанр
- Загрузка треков: FLAC/WAV → S3 → BullMQ (прогресс-бар)
- `PublishButton` — смена DRAFT→PUBLISHED или DRAFT→SCHEDULED с датой

**Менеджер треков** (`track-manager.tsx` на странице релиза) — функциональный паритет с `/admin/tracks/[id]/edit`:
- **Drag-n-drop порядка** треков (motion `Reorder`, тач-дружелюбный drag-handle ≥44px),
  персист одним атомарным запросом `PUT /api/v1/dashboard/releases/[id]/tracks { order: string[] }`
  (use-case `TrackService.reorderTracks` + `ITrackRepository.reorder` в транзакции).
- **Три флага** через общий `Check`: Explicit (18+), Эксклюзив, WIP (демо) — каждый
  сохраняется оптимистично через `PATCH /tracks/[id]`.
- BPM/тональность, настроения (`MoodPicker`), жанры (`GenrePicker`), кредиты (`CreditsEditor`),
  текст/LRC (`LyricsEditor`).
- **Кредиты**: роль выбирается пилюлями (не нативным `<select>`); при пустом списке —
  быстрое «+ {артист} — исполнитель».
- **Фиты**: роль кредита `FEATURED` («Гость (feat.)») → на витрине склеивается в
  «Title (feat. A, B)» (`lib/track-display.ts`); в строке кредитов feat-имена не дублируются.
- **Версия трека**: поле `tracks.version` (миграция 0025) — «Radio Edit», «Slowed + Reverb»
  и т.п., отдельно от названия; на витрине суффикс «— Version».
- **Жанр релиза**: кастомный дропдаун `components/genre-select.tsx` (поиск + группы +
  click-outside, скрытый input для FormData) вместо нативного `<select>`.
- **Навигация «назад»**: единая `btnGhost`-кнопка на всех экранах дашборда.
- **Контент-гигиена**: при дублировании имени артиста в названии трека/релиза — мягкий
  инлайн-ворнинг (чистый детектор `lib/title-hygiene.ts`, не блокирует сохранение) + хинты в формах.

**Профиль** (`/dashboard/profile`)
- Имя, bio, аватар, header-изображение
- Темизация: live color picker + расширенные пресеты → `theme_tokens` JSONB
- Grain on/off, выбор шрифта

**Посты/анонсы** (`/dashboard/posts`)
- Создание анонса: composer с markdown-подмножеством
- Инлайн-редактирование существующего поста
- Оптимистичное удаление

**Аналитика** (виджеты в `/dashboard`)
- Прослушивания: суточные/недельные/месячные `play_events`
- «Переслушивания» — трек, к которому вернулись 2+ разных дня (`StatsSection`)
- Live-счётчик «слушают сейчас» в шапке

## Дизайн-кит

Дашборд и админка делят единый набор примитивов `apps/web/components/ui-kit.tsx`
(токены `foreground/X` вместо `white/X`, `Field`, `Check`, `Badge`/статус-бейджи,
`StatCard`, `btnPrimary`/`btnGhost`, `fieldClass` и т.д.). `components/admin/ui.tsx`
ре-экспортит этот кит. Дашборд рендерится на платформенном шелле (без темы артиста),
поэтому общий кит безопасен.

## Где код

- **Страницы:** `apps/web/app/dashboard/`
- **UI-кит:** `apps/web/components/ui-kit.tsx` (общий с админкой)
- **Менеджер треков:** `apps/web/app/dashboard/releases/[id]/track-manager.tsx`
- **API релизов:** `apps/web/app/api/v1/dashboard/releases/`
- **Reorder треков:** `PUT apps/web/app/api/v1/dashboard/releases/[id]/tracks/route.ts`
- **API профиля:** `apps/web/app/api/v1/dashboard/profile/route.ts`
- **API постов:** `apps/web/app/api/v1/dashboard/posts/route.ts`, `[id]/route.ts`
- **API загрузки:** `apps/web/app/api/v1/dashboard/releases/[id]/tracks/upload/route.ts`
- **Аналитика:** `apps/web/app/api/v1/dashboard/stats/route.ts`
- **Сервисы:** `packages/core/src/services/` — `artist`, `release`, `track`
- **DB таблицы:** `releases`, `tracks`, `track_audio`, `artist_posts`, `play_events`

## Env-переменные

```
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
REDIS_URL=
```

## Известные ограничения

- Аналитика переслушиваний считается на лету из `play_events` — при большом объёме может быть медленной
- Нет уведомлений о завершении транскодинга в UI (надо обновить страницу)
- Лейаут `/dashboard` сайдбар-фиксированный: скроллится только `<main>`, не весь дашборд
