# Live-присутствие («слушают сейчас»)

## Что делает

Показывает сколько слушателей слушают трек прямо сейчас. Виден на странице трека и в дашборде артиста (суммарно по всем его трекам).

### Механика

- Redis ZSET: ключ `presence:track:{trackId}`, score = Unix timestamp последнего heartbeat
- Плеер отправляет heartbeat `POST /api/v1/tracks/[id]/listening` каждые **20 секунд**
- Окно активности: **45 секунд** — участники старше 45с считаются ушедшими
- Чтение счётчика: `ZCOUNT presence:track:{id} (now-45) +inf`
- Артикул в дашборде: суммируются счётчики всех треков артиста

### Деградация

При недоступности Redis все presence-эндпоинты возвращают `{ count: 0 }` без исключений.  
Реализовано в `apps/web/lib/presence.ts` через try/catch.

## Где код

- **Heartbeat API:** `apps/web/app/api/v1/tracks/[id]/listening/route.ts`
- **Утилиты присутствия:** `apps/web/lib/presence.ts`
- **Компонент счётчика (трек):** в `apps/web/app/artists/[slug]/releases/[releaseId]/tracks/[trackId]/` — live-обновление через polling или SSE
- **Дашборд (заголовок):** `apps/web/app/dashboard/_components/LiveCount.tsx` (или аналог)
- **Redis-клиент:** `ioredis` — тот же `REDIS_URL`, что у BullMQ, но отдельный инстанс

## Env-переменные

```
REDIS_URL=                      # redis://localhost:6379 локально
```

## Известные ограничения

- Анонимные слушатели учитываются (heartbeat без авторизации разрешён)
- Нет deduplicate по userId — один пользователь может открыть трек в двух вкладках и дать +2
- Данные присутствия не попадают в аналитику (только Redis, не Postgres)
- При рестарте Redis счётчики сбрасываются
