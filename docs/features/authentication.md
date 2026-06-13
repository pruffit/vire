# Аутентификация

Auth.js v5 (NextAuth) с несколькими провайдерами и привязкой их к одному аккаунту.
Стратегия — JWT (httpOnly cookie).

## Что делает
- **Провайдеры:** email/пароль (Credentials, `bcryptjs`), magic link (Nodemailer →
  Brevo HTTP API), Yandex, Google, Telegram Login Widget (проверка HMAC-SHA256).
- **Привязка нескольких провайдеров** к одному аккаунту через cookie
  `vire_link_uid` (см. `/profile` → «Способы входа»).
- **Роли** (`LISTENER | ARTIST | MODERATOR | ADMIN | SUPERADMIN`) кладутся в JWT
  при логине. Смена роли/имени/аватара требует **перелогина** (JWT не перечитывает
  БД); поэтому `/profile` читает актуальные данные из БД.
- **Брутфорс-защита:** `authorize` Credentials лимитирует попытки входа по IP
  (30 / 5 мин, Redis fixed-window); при превышении — `null`. Деградирует мягко.
- **Защита маршрутов:** `proxy.ts` (middleware) — `/admin` по роли, `/dashboard`
  /`/settings`/`/upload` по входу; API-роуты дополнительно гардят владение в хендлере.

## Где код
- **Конфиг:** `apps/web/auth.ts` (провайдеры, callbacks, адаптер Drizzle)
- **Middleware:** `apps/web/proxy.ts`
- **Письма:** `apps/web/lib/mailer.ts` (Brevo HTTP API — SMTP не используется)
- **Рейт-лимит:** `apps/web/lib/rate-limit.ts`
- **Данные:** `@vire/db` — `users`, `accounts`, `sessions`, `verificationTokens`;
  хелперы `findUserByEmail`, `findOrCreateTelegramUser`, `tryClaimOAuthAccount`

## Env
- `AUTH_SECRET` — подпись JWT.
- `AUTH_URL` / `NEXT_PUBLIC_SITE_URL` — базовый URL.
- OAuth: `AUTH_YANDEX_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`.
- Telegram: `AUTH_TELEGRAM_BOT_TOKEN` (для HMAC).
- Почта: `BREVO_API_KEY`, `SMTP_FROM`.

## Ограничения / на будущее
- Нет 2FA.
- Брутфорс-лимит — по IP (не по аккаунту): за NAT несколько пользователей делят счётчик.
- Роль в сессии «застывает» до перелогина — осознанный компромисс стратегии JWT.
