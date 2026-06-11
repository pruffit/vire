# Аутентификация

## Что делает

Вход через Yandex OAuth (основной) и Resend magic-link (email). Сессия — JWT (не DB-сессии). Роли хранятся в токене и проверяются в middleware.

Роли (по возрастанию прав): `LISTENER` → `ARTIST` → `MODERATOR` → `ADMIN` → `SUPERADMIN`.

Присвоить роль: `pnpm --filter @vire/db db:make-admin <email> [role]` — пользователь должен перелогиниться.

## Где код

- **Конфиг Auth.js:** `apps/web/auth.ts`, провайдеры — Yandex + Resend
- **Proxy-хелпер:** `apps/web/lib/proxy.ts` — переопределяет `basePath` для работы за реверс-прокси
- **Middleware (route guard):** `apps/web/middleware.ts` — защищает `/dashboard` (ARTIST+) и `/admin` (MODERATOR+)
- **Session type extension:** `apps/web/types/next-auth.d.ts` — добавляет `role`, `artistProfileId` в сессию
- **DB таблицы:** `users`, `accounts`, `sessions`, `verification_tokens` — стандартная Auth.js схема (`packages/db/src/schema/auth.ts`)
- **Роль в схеме:** `users.role` enum `UserRole`

## Env-переменные

```
AUTH_SECRET=                    # обязательно
AUTH_URL=                       # публичный URL (https://vire.ru)
AUTH_YANDEX_ID=
AUTH_YANDEX_SECRET=
AUTH_RESEND_KEY=                # Resend API key для magic-link
EMAIL_FROM=                     # отправитель magic-link (noreply@vire.ru)
```

## Известные ограничения

- JWT — смена роли вступает в силу только после новой авторизации (нет инвалидации сессии)
- Magic-link только для входа; привязка email не верифицируется отдельно
- Yandex OAuth требует `proxy.ts` на проде за nginx (перенаправление callback)
