# Права доступа (RBAC) и аудит-лог

Единый гейт прав: одна матрица «роль → права» в `packages/core`, один хелпер на входе
в HTTP-слое, запись мутаций бэкофиса в `audit_log`.

## Что делает

- Решение «можно ли» принимается в одном месте — чистой функцией `can(actor, permission)`.
  Раньше набор admin-ролей существовал шестью независимыми литералами и успел разойтись.
- Роли: `LISTENER`, `ARTIST`, `VIEWER`, `MODERATOR`, `ADMIN`, `SUPERADMIN`.
- Права и кто их имеет:

| Право | Роли | Что закрывает |
|---|---|---|
| `admin.panel.view` | VIEWER+ | вход в `/admin` (middleware, layout, пункт меню) |
| `admin.read` | VIEWER+ | любые GET бэкофиса: система, audio-features, genre-suggestions |
| `admin.content.moderate` | MODERATOR+ | статусы треков/релизов, верификация и скрытие артистов, resolve жалоб, analyze, retranscode, очереди, правка постов/плейлистов/сущностей, участники артиста |
| `admin.users.manage` | ADMIN+ | смена роли пользователя, создание артиста |
| `admin.jobs.run` | ADMIN+ | генерация подборок, backfill анализа |
| `staff.content.preview` | MODERATOR+ | манифест неопубликованного трека, страница артиста без публичных релизов |

- **VIEWER** — наблюдатель: читает весь бэкофис, любая мутация даёт 403, а кнопки мутаций
  ему не показываются (пропы `canMutate` / `canManageUsers` / `canRunJobs`).
- **Роль `ARTIST` прав не имеет намеренно.** Артист-периметр (`/dashboard`) держится на
  ownership — строке в `artist_profiles` через `getActiveArtist`, не на роли. Защищать
  дашборд «по роли ARTIST» нельзя: сломается несколько аккаунтов на артиста.
- Каждая успешная мутация бэкофиса пишет строку в `audit_log` (кто, какая роль, какое право,
  какое действие, над чем). Сбой записи не отменяет саму операцию.

## Где код

- **Матрица и `can()`:** `packages/core/src/platform/access/{permissions,can}.ts`,
  вход — подпуть `@vire/core/access` (не barrel: `proxy.ts` исполняется в edge).
- **Гейт HTTP:** `apps/web/lib/require-access.ts` — `requireAccess(permission)` → `{ok, actor, audit}`
  либо `{ok:false, response}` (401 без сессии, 403 без права); `requireUser()` — только логин.
- **Server Components:** `apps/web/lib/admin-access.ts` — `getAdminAccess()` отдаёт флаги для
  условного рендера кнопок.
- **Server actions:** `apps/web/app/admin/actions.ts` — `requireAction(permission)`, отказ = `throw`.
- **Периметр:** `apps/web/proxy.ts`, `app/admin/layout.tsx`, `app/api/v1/admin/**`,
  `app/api/v1/tracks/[id]/manifest`, `lib/artist-visibility.ts`, `components/nav.tsx`.
- **Данные:** `packages/db/src/schema/audit.ts` (таблица `audit_log`, миграция `0052`),
  запись — `packages/db/src/queries/audit.ts` (`insertAuditEntry`).

## Env

Не требуется.

## Ограничения / на будущее

- Гейт переведён на admin-периметр. Остальные ~79 роутов проверяют только факт логина
  (`auth()` инлайн) — их перевод на `requireUser()` следующей пачкой.
- Ownership (артист владеет треком, пользователь владеет плейлистом) в матрицу не входит:
  он зависит от данных, а не от роли, и живёт в сервисах core (`authorizeTrackOwnership`).
- `audit_log` только пишется — экрана просмотра в админке пока нет.
- Роль в JWT выписывается при логине: после смены роли нужен релогин, иначе гейт видит старую.
