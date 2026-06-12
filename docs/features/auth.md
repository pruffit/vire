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
AUTH_URL=                       # публичный URL (https://viremusic.ru)
AUTH_YANDEX_ID=
AUTH_YANDEX_SECRET=
SMTP_HOST=smtp-relay.brevo.com  # SMTP-сервер (Brevo)
SMTP_PORT=587
SMTP_LOGIN=                     # логин Brevo (из Transactional → SMTP & API)
SMTP_PASSWORD=                  # пароль Brevo
SMTP_FROM=Vire <noreply@viremusic.ru>   # отправитель (домен должен быть верифицирован)
FEEDBACK_TO=                    # куда падает форма обратной связи
```

## Известные ограничения

- JWT — смена роли вступает в силу только после новой авторизации (нет инвалидации сессии)
- Magic-link только для входа; привязка email не верифицируется отдельно
- Yandex OAuth требует `proxy.ts` на проде за nginx (перенаправление callback)
