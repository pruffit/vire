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

### Подпись sessionId (анти-накрутка)

`sessionId` (общий для heartbeat присутствия, `/listening` и play-события) выдаёт
только сервер — `POST /api/v1/session` генерит `uuid` и подписывает HMAC-SHA256
(`apps/web/lib/session-signing.ts`, секрет — `LINK_SIGNING_SECRET` или `AUTH_SECRET`,
см. `apps/web/lib/app-secret.ts`). Клиент (`apps/web/lib/session-id.ts`, кэш в
`sessionStorage`) не может придумать свой id — только запросить подписанный.
`/api/v1/presence`, `/api/v1/tracks/[id]/listening` и `/api/v1/tracks/[id]/play`
проверяют подпись (`verifySessionId`) и отбрасывают запрос (`400`) при её отсутствии
или несовпадении. Без секрета в env — деградация до прежнего (неподписанного)
поведения: подпись не проверяется вообще, счётчики остаются приблизительными
(принятый риск, косметика — см. `docs/superpowers/specs/2026-07-10-audit-tail.md`, C2).

## Где код

- **Heartbeat API:** `apps/web/app/api/v1/tracks/[id]/listening/route.ts`
- **Утилиты присутствия:** `apps/web/lib/presence.ts`
- **Компонент счётчика (трек):** в `apps/web/app/[locale]/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/` — live-обновление через polling или SSE
- **Дашборд (заголовок):** `apps/web/app/[locale]/dashboard/live-now.tsx`
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
