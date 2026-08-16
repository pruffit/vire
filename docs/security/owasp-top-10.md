# OWASP Top 10 — проход по чек-листу

> Аудит проведён 13 июня 2026 по коду `main`. Базовый ревью + точечные фиксы.
> Статус: ✅ закрыто · ⚠️ принятый риск / на контроле · 🔜 к следующему этапу.
> Повторять при крупных изменениях auth, API-роутов и обработки внешнего ввода.

Площадка маленькая (≈5 живых пользователей), но поверхность типовая: аутентификация
с несколькими провайдерами, загрузка файлов, пользовательский контент, платёжный
вебхук (Этап 2). Ниже — по категориям OWASP Top 10 (2021).

---

## A01:2021 — Broken Access Control ✅

- **Middleware** (`proxy.ts`): `/admin` требует вход **и** роль из
  `{MODERATOR, ADMIN, SUPERADMIN}`; `/dashboard`, `/settings`, `/upload` — вход.
- **In-handler проверки владения** (defense in depth, не полагаемся только на middleware):
  - треки: `PATCH/DELETE /tracks/[id]` → `authorizeArtist` + сервис проверяет
    `release.artistProfileId === artist.id`;
  - релизы: `PATCH /releases/[id]` сверяет `release.artistProfileId`;
  - аватар/профиль артиста: `findByUserId` → действия только над своим профилем;
  - статус треков релиза: `GET /releases/[id]/tracks` проверяет владение.
- **Admin-API** (`/api/v1/admin/*`) — оба роута (`editorial`, `backfill-analysis`)
  под `requireAdmin`. Большинство админ-действий — server actions, тоже гардятся.
- **IDOR**: id — UUID, доступ всегда сверяется с владельцем; прямых ссылок на
  чужие ресурсы по угадываемому id нет.
- **JWT и роль**: роль кладётся в токен при логине; смена роли требует перелогина
  (задокументировано в CLAUDE.md). Эскалации через клиент нет — роль из подписанного JWT.

## A02:2021 — Cryptographic Failures ✅

- Пароли — `bcryptjs` (`compare`/хэш), открытым текстом не хранятся.
- Magic-link токены и OAuth-state (Yandex) — генерируются и проверяются внутри Auth.js.
- Сессии — Auth.js v5, JWT (httpOnly cookie), `AUTH_SECRET` из env.
- TLS — Caddy авто-TLS на проде; HSTS `max-age=63072000; includeSubDomains; preload`.
- Секреты — только в env (`.env` не в гите); в код не зашиты.
- FLAC-мастера — приватный S3 (`vault`), отдаются только по presigned URL.

## A03:2021 — Injection ✅

- **SQL**: Drizzle ORM, параметризованные запросы. Сырой `sql`-шаблон используется
  только для выражений (`coalesce`, `now()`), пользовательский ввод туда не
  интерполируется (в CLAUDE.md зафиксированы quirks, чтобы не сломать это).
- **XSS**: React экранирует по умолчанию. Единственный `dangerouslySetInnerHTML` —
  `json-ld.tsx`, где `JSON.stringify(...).replace(/</g, '\\u003c')` защищает от
  инъекции `</script>` в пользовательских строках (bio, названия).
- **Валидация входа**: zod на API; multipart-поля и кредиты проходят
  `sanitizeCredits`/`parseAudioExt`/`validateImageUpload` до попадания в логику.
- **Command injection**: ffmpeg в воркере вызывается с аргументами-массивом (не shell-строкой).

## A04:2021 — Insecure Design ✅

- Слоистая архитектура: handler → service (core) → repository → БД; бизнес-правила
  изолированы и тестируются как чистые функции.
- Загрузка файлов: лимит размера, проверка magic bytes (реальные байты заголовка,
  не MIME), для картинок — формат/размер/соотношение из заголовка. Кодек аудио не
  ограничиваем (ffmpeg в воркере форматно-агностичен) — поверхность та же, что у MP3/FLAC.
- Rate limiting на «дорогих»/абьюзоопасных действиях (см. A07).

## A05:2021 — Security Misconfiguration ✅

- **Заголовки**: статичные (`X-Frame-Options: DENY`, HSTS, `Referrer-Policy`,
  `Permissions-Policy`, COOP) **и CSP** — все в `next.config.ts headers()`.
- **CSP** собирается в `buildCsp()` (`next.config.ts`); `img/connect` ограничены
  known-хостами (S3/CDN, OAuth-аватары). `frame-src` — только YouTube/VK для эмбедов.
  `script-src` содержит `'unsafe-inline'` (в dev ещё `'unsafe-eval'` для webpack) —
  осознанный долг: Next инжектит инлайн-скрипты гидрации/RSC-стриминга без nonce, а
  переход на per-request nonce переводит площадку в dynamic rendering (регрессия LCP
  SEO-страниц) и требует ручного nonce для сырых инлайн-скриптов. Разбор и план возврата —
  `docs/foundation/TECHNICAL_DEBT.md` → «`'unsafe-inline'` в CSP».
- Стек-трейсы наружу не отдаём: API возвращает короткие сообщения об ошибке.
- S3 разделён: `vault` приватный, `stream` публичный только для HLS/обложек/аватаров.
- Dev-эндпоинты/Drizzle Studio на проде не публикуются.

## A06:2021 — Vulnerable and Outdated Components ✅

- **Dependabot** (`.github/dependabot.yml`) — еженедельные PR (npm/pnpm + GitHub Actions).
- `pnpm audit --audit-level=high` в гейтах CI/CD.
- Pinned-версии через pnpm lockfile; обновления проходят через PR + гейты.

## A07:2021 — Identification and Authentication Failures ✅

- Несколько провайдеров (email/пароль, magic link, Yandex; Google/Telegram убраны по 406-ФЗ);
  привязка к одному аккаунту через cookie `vire_link_uid`.
- **Брутфорс-защита (добавлено в этом проходе)**: `authorize` Credentials-провайдера
  лимитирует попытки входа по IP (30 / 5 мин, Redis fixed-window) и при превышении
  возвращает `null`. Деградирует мягко при недоступности Redis.
- Magic link и OAuth-state — внутри Auth.js.
- Пароль не логируется; ответ при неверном логине не различает «нет юзера» / «неверный пароль».
- **Токены устройств (волна 4.2, 16.08.2026)** — `docs/features/device-auth.md`:
  - Пара выдаётся **только по доказанной cookie-сессии** (`POST /v1/auth/devices` отвергает
    вызов с Bearer): второй поверхности проверки пароля не появилось.
  - Access — HMAC-SHA256 поверх компактного тела, TTL 15 мин; проверка подписи в постоянном
    времени (`timingSafeEqual`), подмена роли в теле ломает подпись (тест).
  - Refresh — 32 случайных байта, в БД лежит **только sha256-хэш**; ротация при каждом обмене,
    старый перестаёт действовать немедленно.
  - **Reuse detection**: предъявление refresh уже отозванного устройства трактуется как утечка
    и отзывает все устройства владельца.
  - Роль перечитывается из БД на каждой ротации — понижение прав доезжает без ожидания; исчезнувший
    владелец обрывает доступ.
  - Отзыв действует не позже 30 с (TTL кэша состояния устройства), а на самом отзыве и на
    неудачном refresh кэш сбрасывается явно.
  - Rate limit: 10 регистраций/час и 30 обменов/час на клиента; ответы с токенами — `no-store`.
  - Нет секрета подписи (`LINK_SIGNING_SECRET`/`AUTH_SECRET`) → Bearer не принимается (fail-closed).
  - Наружу не отдаются ни хэш refresh, ни срок его жизни (контракт `deviceSchema`).

## A08:2021 — Software and Data Integrity Failures ✅ / 🔜

- **YooKassa webhook** верифицируется обращением к API по `paymentId` (не доверяем телу).
  Этап 2 (UI продаж) отвязан до старта; тесты webhook — 🔜 при включении продаж.
- CI/CD деплоит образы из GHCR по тегу `vX.Y.Z` через гейты (typecheck/lint/test/audit/build).
- Внешних CDN для исполняемого JS нет — всё из собственной сборки.

## A09:2021 — Security Logging and Monitoring Failures 🔜

- Сейчас: серверные ошибки → stdout контейнера; админ-обзор (`/admin`) пингует
  Postgres/Redis/очереди (`lib/admin-health.ts`).
- **План (отдельная задача «Мониторинг»)**: Sentry (ошибки фронта+воркера),
  внешний uptime-чек (`/api/health`), алерты на упавшие джобы BullMQ.
  Health-эндпоинт и алерты воркера добавлены вместе с этим проходом.

## A10:2021 — Server-Side Request Forgery (SSRF) ✅

- Серверные `fetch` бьют только в **фиксированные** хосты: Brevo (`mailer.ts`),
  VK API (`vk-api.ts`), YooKassa (`yookassa.ts`). Хост не берётся из пользовательского ввода.
- Пользовательские URL (ссылки/видео артиста) **не запрашиваются с сервера** —
  только парсятся в эмбед (`embed.ts`, whitelist хостов YouTube/VK, id — `\d+` у VK)
  и рендерятся как `iframe src` к доверенным доменам.
- VK `videoId` уходит в запрос через `encodeURIComponent` — инъекция query-параметров исключена.

---

## Итог

Базовый уровень закрыт. В этом проходе добавлено: **rate-limit на логине** (A07)
и **health-эндпоинт + алерты воркера** (A09). Открытые пункты — наблюдаемость
(Sentry/uptime, задача «Мониторинг») и тесты платёжного вебхука (Этап 2).
