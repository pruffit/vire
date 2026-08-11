# План: platform/access — единый гейт прав

**Спека:** `docs/superpowers/specs/2026-08-11-platform-access-rbac.md`
**Срезы идут последовательно** — каждый следующий опирается на предыдущий.

---

## Срез A — матрица прав в core (Sonnet)

**Файлы:**
- `packages/core/src/platform/access/permissions.ts` — `PlatformRole`, `Permission`, `Actor`, `ROLE_PERMISSIONS`
- `packages/core/src/platform/access/can.ts` — `can(actor, permission)`
- `packages/core/src/platform/access/index.ts` — реэкспорт
- `packages/core/src/platform/access/can.test.ts` — TDD, тесты **до** реализации
- `packages/core/package.json` — подпуть `"./access": "./src/platform/access/index.ts"`

**Матрица — из спеки, дословно.** `ROLE_PERMISSIONS: Record<PlatformRole, readonly Permission[]>`;
`can(null, …) === false`. Никакого ownership, никакого I/O — чистые функции.

**Тесты:** каждая роль × каждое право (таблично); отдельные явные тесты —
`ARTIST` не имеет ни одного права; `MODERATOR` не имеет `admin.users.manage` и `admin.jobs.run`;
`VIEWER` имеет `admin.read`, но не `admin.content.moderate`.

**Barrel:** в корневой `index.ts` access **не** реэкспортируем — только подпуть (edge).

**Гейты:** `pnpm --filter @vire/core typecheck`, `pnpm --filter @vire/core test`,
`pnpm turbo run check:layers`.

---

## Срез B — единый гейт в web (Sonnet)

**Новое:** `apps/web/lib/require-access.ts` + `apps/web/lib/require-access.test.ts`

```ts
requireAccess(permission): { ok: true; actor; audit } | { ok: false; response }
requireUser(): { ok: true; actor } | { ok: false; response }
```
Нет сессии → 401 `{ error: 'Unauthorized' }`; нет права → 403 `{ error: 'Forbidden' }`
(формы ответов не менять — их ждут существующие тесты). `audit` — заглушка-функция в этом
срезе, наполняется в срезе C.

**Переводится (порядок такой):**

1. `apps/web/proxy.ts:10,43` — `ADMIN_ROLES` → `can(actor, 'admin.panel.view')` из `@vire/core/access`.
2. `apps/web/app/admin/layout.tsx:6` — то же право.
3. `apps/web/app/admin/actions.ts` — `requireAdmin()` разделяется по правам:
   - `actionSetUserRole`, `actionCreateArtist` → `admin.users.manage` (**сужение**, чинит эскалацию)
   - остальные 17 мутаций → `admin.content.moderate`
   - `actionListArtistMembers` (чтение) → `admin.read`
   - **VIEWER больше не no-op:** отказ = `throw new Error('Forbidden')`, как для прочих ролей.
4. Роуты `apps/web/app/api/v1/admin/*`:
   - `system` GET → `admin.read`
   - `tracks/[id]/audio-features` GET, `tracks/[id]/genre-suggestions` GET → `admin.read` (**фикс бага**)
   - `tracks/[id]/analyze`, `tracks/[id]/analyze-genre`, `reports/[id]/resolve` → `admin.content.moderate`
   - `editorial`, `backfill-analysis` → `admin.jobs.run`, **no-op для VIEWER убирается** → 403
5. `apps/web/app/api/v1/tracks/[id]/manifest/route.ts:6` — `STAFF_ROLES` → `staff.content.preview`;
   ветка ownership артиста остаётся как есть.

**UI:** кнопки/селекты мутаций в админке скрываются для VIEWER. Роль в Server Component берётся
из `auth()`, прокидывается пропом `canMutate` в клиентские компоненты
(`app/admin/users/user-role-select.tsx`, `create-artist-form.tsx`, кнопки статусов/очередей).
Новых компонентов не создавать — только условный рендер существующих.

**Тесты:** обновить существующие route-тесты под новую политику **до** правки роутов
(там уже есть класс тестов прав, паттерн `vi.mock('@/auth')`); добавить тест на
`actionSetUserRole` под MODERATOR → Forbidden.

**Гейты:** typecheck/lint/test web, `check:routes`, `audit:design` (трогали UI).

---

## Срез C — аудит-лог (Sonnet)

**Схема:** `packages/db/src/schema/audit.ts` — таблица `audit_log`
(`id` uuid pk defaultRandom, `actor_user_id` uuid FK `users.id` on delete set null,
`actor_role` text, `permission` text, `action` text, `target_type` text null,
`target_id` text null, `meta` jsonb null, `created_at` timestamp defaultNow),
индексы `(created_at desc)`, `(actor_user_id)`. Экспорт из `packages/db/src/schema/index.ts`.

**Миграция:** `pnpm --filter @vire/db db:generate` (следующая после `0051_*`), применить локально.

**Запись:** `packages/db/src/queries/audit.ts` — `insertAuditEntry(...)`, экспорт из `src/index.ts`.
`requireAccess` отдаёт `audit(action, target?, meta?)`, привязанный к актору и праву; вызывается
**после** успешной мутации. Ошибка записи логируется и глотается — аудит не роняет операцию.

**Подключение:** мутирующие admin-роуты и server actions из среза B.

**Тесты:** `insertAuditEntry` вызывается на успешной мутации и не вызывается при 403;
падение записи не меняет ответ роута.

**Гейты:** typecheck db/web, test web, `pnpm --filter @vire/db db:generate` не оставляет
незакоммиченных изменений схемы.

---

## После всех срезов

- Прожарка дифа отдельным сабагентом (Sonnet) по VireMusic-чеклисту: приватность/права, мобилка
  админки, дубли, краевые случаи.
- `docs/features/rbac.md` — новая фича не готова без файла.
- Обновить `docs/migration-plan.md` (волна 1 ✅) и журнал фаз в `docs/roadmap/platform-core-brief.md`.
- Полный verify-контракт: typecheck, lint, check:routes, check:i18n, check:layers, test, audit:design, build.
