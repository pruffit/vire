# 1-H: тесты остатка роутов — дизайн

Кусок 1-H из нарезки §1 (`2026-07-12-stage2-refactor-slicing-design.md`).
Только тесты — **ни строчки прод-кода не менять**. Если тест вскрывает баг —
не чинить молча: зафиксировать в отчёте, решение принимает главная сессия.

Паттерн — существующие `route.test.ts` (эталоны:
`app/api/v1/dashboard/profile/route.test.ts`, `app/api/v1/search/route.test.ts`):
`vi.mock('@vire/db')` с `class { method = vi.fn() }` / query-моками,
`vi.mock('@/auth')`, моки rate-limit/Redis/S3/очередей по месту.

## Скоуп — 13 роутов без тестов (58 всего, 43 покрыты)

### H1 — простые (8 роутов, ~22 кейса)

| Роут | Что проверять |
|---|---|
| `api/auth/[...nextauth]` GET/POST | rate-limit POST → 429; проксирование в NextAuth-хендлеры (GET без лимита) |
| `api/health` GET | 200 при живых БД+Redis; 503 degraded при падении БД / Redis / обоих; поля version/ts |
| `api/v1/health` GET | БД критична (503), Redis сигнальный (200 с флагом) |
| `api/v1/admin/backfill-analysis` POST | 401 аноним, 403 не-админ, VIEWER-no-op, постановка в очередь |
| `api/v1/admin/editorial` POST | 401/403/VIEWER-no-op, вызов генерации |
| `api/v1/admin/system` GET | 401/403 (VIEWER проходит), форма ответа |
| `api/v1/artists/[slug]` GET | NotFoundError→404, else→500, happy |
| `api/v1/listening-now` GET | happy, деградация при ошибке → пустой массив |

### H2 — сложные (5 роутов, ~34 кейса)

| Роут | Что проверять |
|---|---|
| `api/v1/dashboard/live` GET | 401, 403 чужой артист, Redis-деградация → count:0, happy |
| `api/v1/dashboard/tracks/[id]/genres` PUT | 401, 403 ownership, 400 UUID/JSON/enum, лимит 3, happy |
| `api/v1/dashboard/tracks/[id]` PATCH/DELETE | 401, 403, 400 UUID/пустой patch/валидации полей, Result→статусы, happy оба метода |
| `api/v1/user/profile` PATCH/POST | 401, 400 zod-имя, FormData: removeAvatar, валидация изображения, S3-upload + `?v=` cache-bust |
| `api/v1/feedback` POST | 429 rate-limit, 400 JSON/zod, 502 при ошибке отправки, happy |

Вне скоупа: `purchase`, `webhooks/yookassa` (Этап 2, заморожено до команды).

## Исполнение

- **H1, H2** — два Sonnet-агента последовательно (H2 берёт паттерны H1).
  Гейты после каждого: web typecheck/lint/test; после H2 — полный набор + build.
- **H3** — доки: stage-2 §1.1, TECHNICAL_DEBT (кандидаты live/genres закрыты),
  CLAUDE.md счётчик тестов.
- Самокритика: для тестового среза — облегчённая (ревью качества тестов: не
  smoke ли, точные ли статусы/тексты, нет ли тестов «под реализацию» вместо
  контракта), отдельным Sonnet-агентом после H2.
