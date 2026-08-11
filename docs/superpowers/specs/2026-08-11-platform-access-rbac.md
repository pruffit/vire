# platform/access — единый гейт прав (волна 1 плана миграции)

**Дата:** 11.08.2026 · **Основание:** `docs/migration-plan.md` волна 1, `docs/architecture-audit.md` Б4

## Проблема (по факту кода, не по гипотезе)

Авторизация размазана: `auth()` вызывается инлайн в 79 из 109 route-файлов, роль проверяется
в 10 файлах, общего хелпера нет. Набор admin-ролей существует четырьмя независимыми литералами
(`proxy.ts:10`, `app/admin/layout.tsx:6`, `app/admin/actions.ts:22-23`, `api/v1/admin/system/route.ts:7`).

Что уже разошлось:

1. **Живой баг.** `GET /api/v1/admin/tracks/[id]/audio-features` и `.../genre-suggestions` требуют
   MODERATOR+, а страница `/admin/tracks/[id]/edit`, которая их и запрашивает, открыта VIEWER.
   Наблюдатель видит страницу с отвалившимися блоками.
2. **Эскалация привилегий.** `actionSetUserRole` гейтится общим `canMutate` (MODERATOR+), то есть
   **MODERATOR может выдать себе SUPERADMIN**. Там же `actionCreateArtist` — создание артиста
   на чужой email.
3. Одно и то же «read-only юзер нажал мутацию» обработано двумя способами: тихий no-op 200
   (`editorial`, `backfill-analysis`, все server actions) и 403 (`admin/tracks/*/analyze*`,
   `reports/[id]/resolve`).
4. `MODERATOR` допущен ко всем мутациям админки, но не к `editorial`/`backfill-analysis` (ADMIN+).
5. Ownership трека дублируется инлайн пять раз (`dashboard/tracks/[id]/{genres,analyze,analyze-genre,audio-features,genre-suggestions}`)
   вместо готовой `authorizeTrackOwnership` из core.
6. Роль `ARTIST` **не участвует в авторизации нигде** — артист-периметр держится на строке
   в `artist_profiles` (`getActiveArtist`), а не на роли. Не баг, но матрица прав обязана это
   отразить явно, иначе следующий разработчик защитит роут «по роли ARTIST» и сломает мульти-артистов.

## Решения по развилкам (зафиксировано Danya 11.08.2026)

| Развилка | Решение |
|---|---|
| VIEWER | Читает всё в админке (включая audio-features/genre-suggestions); любая мутация — честный 403; кнопки мутаций в UI для VIEWER скрыты |
| MODERATOR и тяжёлые фоновые работы | `editorial`/`backfill-analysis` остаются ADMIN+, правило закрепляется тестом |
| Аудит-лог | Делаем в этой волне |

## Решение

### Ярус 1 — `packages/core/src/platform/access/` (чистая логика)

```
PlatformRole = 'LISTENER' | 'ARTIST' | 'VIEWER' | 'MODERATOR' | 'ADMIN' | 'SUPERADMIN'
Actor        = { id: string; role: PlatformRole }
Permission   = 'admin.panel.view' | 'admin.read' | 'admin.content.moderate'
             | 'admin.users.manage' | 'admin.jobs.run' | 'staff.content.preview'
can(actor: Actor | null, permission: Permission): boolean
```

`ROLE_PERMISSIONS` — единственный источник правды. Матрица:

| Permission | Кто | Что закрывает |
|---|---|---|
| `admin.panel.view` | VIEWER, MODERATOR, ADMIN, SUPERADMIN | вход в `/admin`, middleware |
| `admin.read` | те же | любые GET админки: `admin/system`, `audio-features`, `genre-suggestions` |
| `admin.content.moderate` | MODERATOR, ADMIN, SUPERADMIN | статусы треков/релизов, верификация и скрытие артистов, resolve жалоб, analyze, retranscode, очереди, правка постов/плейлистов/сущностей, участники артиста |
| `admin.users.manage` | ADMIN, SUPERADMIN | смена роли пользователя, создание артиста ← чинит эскалацию |
| `admin.jobs.run` | ADMIN, SUPERADMIN | `editorial`, `backfill-analysis` |
| `staff.content.preview` | MODERATOR, ADMIN, SUPERADMIN | manifest неопубликованного трека (`tracks/[id]/manifest`) |

Роль `ARTIST` прав не получает **намеренно**: артист-периметр — ownership, не роль.
Ownership в матрицу не тащим (он зависит от данных, а не от роли) — он остаётся в сервисах
core (`authorizeTrackOwnership`).

Экспорт — подпутём `@vire/core/access` (не через barrel): `proxy.ts` исполняется в edge,
тащить туда весь barrel незачем.

### Ярус 2 — `apps/web/lib/require-access.ts`

```ts
requireAccess(permission): Promise<{ ok: true; actor: Actor; audit: AuditFn } | { ok: false; response: NextResponse }>
requireUser(): Promise<{ ok: true; actor: Actor } | { ok: false; response: NextResponse }>
```

Отказ: нет сессии → 401, роль без права → 403. `audit` — привязанная к актору функция записи
(см. ярус 3), вызывается вызывающим **после** успешной мутации: гейт знает право, деталь действия
знает роут.

Периметр этой волны: `/admin`-периметр целиком (middleware, layout, 10 admin-роутов, 19 server
actions) + `tracks/[id]/manifest`. Остальные ~79 роутов «просто залогинен» — следующая пачка,
их политика сегодня однородна и рисков не создаёт.

### Ярус 3 — аудит-лог

Таблица `audit_log`: `id`, `actor_user_id` (FK users, `on delete set null`), `actor_role`,
`permission`, `action`, `target_type`, `target_id`, `meta jsonb`, `created_at`.
Индексы: `(created_at desc)`, `(actor_user_id)`. Пишется только на успешных мутациях
admin-периметра. Сбой записи не роняет операцию (лог — не транзакция бизнес-действия).

## Изменения поведения (осознанные)

1. VIEWER получает 200 вместо 403 на GET `audio-features`/`genre-suggestions` — фикс бага.
2. VIEWER получает 403 вместо тихого 200 на `editorial`/`backfill-analysis` и во всех server
   actions; кнопки мутаций админки для VIEWER скрываются.
3. MODERATOR теряет доступ к смене ролей и созданию артиста (ADMIN+) — закрытие эскалации.
   **Это единственное сужение прав в волне**, оно намеренное.

## Проверка

- Unit-тесты матрицы в core: каждая роль × каждое право, включая явный тест «ARTIST прав не имеет»
  и «MODERATOR не может `admin.users.manage`».
- Route-тесты: существующий класс тестов прав обновляется под новую политику до перевода роута,
  не после. Каждый переведённый роут — тест на 401/403/успех.
- Аудит: мутация в админке → строка в `audit_log`; VIEWER → ни строки.

## Откат

Ярус 1 — удаление директории (её никто не вызывал бы). Ярус 2 — пачка роутов ревертится
независимо. Ярус 3 — отключение записи, таблица остаётся пустой и безвредной.
