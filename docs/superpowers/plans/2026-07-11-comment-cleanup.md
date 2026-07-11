# План: чистка комментариев (2026-07-11)

Спека: `docs/superpowers/specs/2026-07-11-comment-cleanup.md`.

Фан-аут на 6 Sonnet-сабагентов, области не пересекаются:

1. Плеер: `apps/web/components/player/**`, `apps/web/lib/player/**`, `apps/web/store/**` (~260 строк комментов)
2. `apps/web/components/**` кроме player (~600)
3. `apps/web/lib/**` кроме player + корень apps/web (`auth.ts`, `next.config.ts`, `instrumentation.ts`, `middleware.ts`, `proxy.ts`) (~350)
4. `apps/web/app/**` (~300)
5. `packages/db/**` (~640)
6. `apps/worker/**` + `packages/{core,ui,api-client,api-contracts}/**` (~500)

Агенты НЕ пишут в `docs/` — возвращают список «кандидаты в доки» (файл, знание,
целевой док); главная сессия применяет централизованно.

Дальше: применение доков → гейты (typecheck×3, lint, check:routes, test, build)
→ независимая самокритика (Sonnet, выборочная проверка дифа: не удалено ли
load-bearing, не изменён ли код) → коммит.
