# Спека: bounded JWT-refresh роли/identity + rate-limit на DELETE like

Дата: 2026-07-17. Продолжение §1 «инженерка без продуктовых решений» (TODO.md §1.7,
TECHNICAL_DEBT.md). Ранее сегодня (коммит `c44b803`) закрыто: §1.2 core, `NotFoundError.resource`,
meta-descriptions. Здесь добираем два оставшихся безопасных пункта.

## Триаж — что остаётся открытым и почему это можно закрыть

- **JWT-рассинхрон** — был дескоуплен в `2026-07-17-core-cleanup` с ошибочной формулировкой
  «регрессирует статик-рендеринг» (это довод про CSP-nonce, не про JWT). jwt-callback исполняется
  server-side при резолве сессии; статические страницы `auth()` не зовут — стратегия рендеринга
  не меняется. Реверсируем отсрочку: делаем bounded-фикс.
- **Rate-limit на `DELETE /api/v1/tracks/[id]/like`** — у POST лимит есть (`like:${uid}` 60/60),
  у DELETE нет. Чистое усиление, без изменения контракта.

**Явно НЕ в скоупе (framework-блок / решено):**
- CSP `'unsafe-inline'` — reduce-motion читает `localStorage` (не CSS-able), RSC-скрипты Next
  требуют nonce → dynamic rendering → регресс LCP. Остаётся в `TECHNICAL_DEBT.md`.
- `request_id`-корреляция — ценна только с агрегатором (Sentry), отложен до апгрейда VPS.
- Playlist `create` narrowing — churn на 4 файла без пользы (решение `c44b803`).
- Идемпотентные DELETE-асимметрии (`unlike`/`playlist unlike` без exists-check) — корректный REST
  (идемпотентный DELETE), не баг. Документируем как намеренное в `TECHNICAL_DEBT.md`.

## Задача A — bounded refresh роли/имени/аватара в JWT

**Проблема.** Роль/имя/аватар кладутся в JWT при логине и не перечитываются из БД. После смены
роли (`db:make-admin`, верификация, `createArtistForUser`) до релогина — рассинхрон авторизации.

**Ключевое ограничение.** `apps/web/proxy.ts` (middleware, **edge-runtime**) вызывает `auth()` и
читает `req.auth.user.role`. DB-чтение (postgres.js) в edge упадёт → refresh только в Node.

**Решение.** В `auth.ts` jwt-callback:
1. На свежем логине (`user` присутствует) — как сейчас (`token.id`, `token.role`) + проставить
   `token.syncedAt = Date.now()`.
2. На последующих вызовах (`user` отсутствует) — если **Node-рантайм** И `now - syncedAt > TTL`
   (`JWT_ROLE_REFRESH_MS`, дефолт 5 мин): `getUserById(token.id)` → обновить `token.role`,
   `token.name`, `token.picture`; проставить `token.syncedAt`. Всё в `try/catch` — при ошибке
   БД/отсутствии юзера токен возвращается **без изменений** (failure-mode = нынешнее поведение).
3. Детект Node: `typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime === 'undefined'`.

**Чистота/тестируемость.** Решение «обновлять ли» вынести в чистый хелпер
`shouldRefreshRole(token, now, ttlMs): boolean` (учитывает наличие `syncedAt`, TTL). Инъекция
времени/детекта рантайма/загрузчика — через параметры внутреннего хелпера, чтобы протестировать
без реального edge/DB. Сам callback тонкий: детект рантайма + `try/catch` + вызов хелпера.

**`getUserById`** (`packages/db/src/queries/users.ts`) — расширить select до
`{ id, role, name, image }` (сейчас `{ id, role }`); единственный существующий call-site
(auth linking) поле-агностичен к добавлению колонок. Тип возврата обновить.

**Тесты (`apps/web` + при нужде `packages/db` мок):**
- `shouldRefreshRole`: нет `syncedAt` → true; свежий (`now - syncedAt < ttl`) → false;
  протухший → true.
- Пограничные: ровно на границе TTL — детерминированно (`>` строгий).
- Замёрженный токен: при успешном refresh роль/имя обновились; при выброшенном loader'е —
  токен неизменен (роль старая), `syncedAt` не сдвинут.

## Задача B — rate-limit на DELETE like

`apps/web/app/api/v1/tracks/[id]/like/route.ts` DELETE: добавить
`rateLimit(\`unlike:${session.user.id}\`, 60, 60)` + `tooManyRequests(rl.retryAfter)` до вызова
сервиса — зеркало POST. Импорты `rateLimit`/`tooManyRequests` уже в файле.

**Тест.** В route-тесте like (если есть) — DELETE отдаёт 429 при превышении; иначе добавить кейс.

## Слои / архитектура (vire-architecture)

- Refresh-логика — в auth-адаптере (`apps/web/auth.ts`), это HTTP/сессионный край, не бизнес-логика.
  Чистый хелпер `shouldRefreshRole` — рядом, юнит-тестируемый.
- `getUserById` — репозиторный/query-слой `@vire/db`, расширение select корректно тут.
- Rate-limit — HTTP-край роута.

## Vire review-чеклист (акценты)

- **Edge/Node граница** — refresh НЕ должен исполняться в middleware; проверить, что при
  выбросе в edge токен цел (fallback), admin-редирект по роли работает как раньше.
- **Инцидент-память** — auth ронял прод (SUPERADMIN). `createArtistForUser` не трогаем; refresh
  только читает роль, не пишет и не понижает.
- Мобилку/UI не трогаем → `audit:design` не обязателен.

## Гейты
`typecheck` (web+core+db), `lint`, `check:routes`, `test`, `build`.

## Ship
Версия +patch в двух `package.json`. Обновить `TECHNICAL_DEBT.md` (JWT → закрыто bounded-refresh'ем;
идемпотентные асимметрии → намеренное) и статусы в `TODO.md`/`stage-2.md §1.7`. Фичедок не нужен
(нет новой пользовательской поверхности) — но заметку про refresh добавить в `docs/features` если
есть auth-док; иначе quirk в `TECHNICAL_DEBT.md` достаточно.
