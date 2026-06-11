# Дашборд артиста (/dashboard)

## Что делает

Личный кабинет артиста. Доступен только пользователям с ролью `ARTIST`+.

### Разделы

**Релизы** (`/dashboard/releases`)
- Список релизов со статусами DRAFT/PUBLISHED/SCHEDULED
- Создание релиза: `/dashboard/releases/new`
- Редактирование: `/dashboard/releases/[id]` — название, обложка, liner notes, credits, жанр
- Загрузка треков: FLAC/WAV → S3 → BullMQ (прогресс-бар)
- `PublishButton` — смена DRAFT→PUBLISHED или DRAFT→SCHEDULED с датой

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

## Где код

- **Страницы:** `apps/web/app/dashboard/`
- **API релизов:** `apps/web/app/api/v1/dashboard/releases/`
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
