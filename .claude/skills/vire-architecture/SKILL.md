---
name: vire-architecture
description: Use when adding or refactoring backend code in Vire — route handlers, services/use-cases, repositories, or anything touching the handler→service→repository layering. Covers Clean/Hexagonal architecture rules, the Result<T,E> error-as-value pattern, dependency injection of effects (Clock/DB/S3), zod validation at the edge, and the FSD frontend layering. Use when deciding which layer code belongs in, where validation goes, how errors flow, or why packages/core must stay framework-free.
version: 1.0.0
user-invocable: true
---

# Vire — слоистая (гексагональная) архитектура

Полные правила — в корневом `CLAUDE.md` (раздел «Архитектурные правила») и
`docs/foundation/architecture.md`. Этот скилл — рабочая выжимка с привязкой к коду.

## Слои строго сверху вниз

```
Route Handler (apps/web/app/api/**/route.ts)  — только HTTP
        ↓
Service / Use-case (packages/core/src/services) — вся бизнес-логика
        ↓
Repository (packages/db/src/repositories)       — запросы к БД
        ↓
PostgreSQL
```

- Хендлер **не знает про БД**. Сервис **не знает про HTTP**. Репозиторий **не знает
  про бизнес-правила**.
- `packages/core` **не импортирует ничего из Next.js** (проверяется архитектурным
  аудитом — см. `docs/roadmap/TODO.md`). Только чистый TS + типы.
- Зависимости вниз: web → core + db; db → core (типы/интерфейсы); core → ни от кого.

## Канонический хендлер (эталон `apps/web/app/api/v1/releases/[releaseId]/route.ts`)

```ts
export async function GET(_req, { params }) {
  const { releaseId } = await params;              // 1. достать вход
  const service = new ReleaseService(new DrizzleReleaseRepository(db)); // 2. собрать DI
  const result = await service.getWithTracks(releaseId);               // 3. вызвать use-case
  if (!result.ok) {                                                    // 4. ошибка как значение
    if (result.error instanceof NotFoundError)
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  return NextResponse.json(result.value);          // 5. ответ
}
```

Хендлер собирает репозиторий, инъектирует в сервис, маппит `Result` → HTTP-код.
Никакого `db.select()` прямо в хендлере.

## Ошибки как значения, не исключения сквозь слои

`packages/core/src/errors.ts`:

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
const ok = (v) => ({ ok: true, value: v });
const err = (e) => ({ ok: false, error: e });
class NotFoundError extends Error { readonly _tag = 'NotFoundError'; ... }
```

Сервисы возвращают `Promise<Result<T, NotFoundError | Error>>`, а не бросают.
Хендлер различает ошибки через `instanceof` и маппит в статус. Бросать исключения
сквозь слои нельзя — они теряют типизацию и валятся в 500.

## Чистота и инъекция эффектов

- Бизнес-правила — **чистые функции** (одинаковый вход → одинаковый выход). Примеры
  чистых билдеров: `lib/structured-data.ts`, `lib/format.ts` — покрыты тестами.
- Все эффекты (БД, S3, время, случайность) — **за интерфейсами**, инъектируются в
  конструктор сервиса (`new ReleaseService(repo)`).
- **Время**: не `new Date()` в логике рендера/правил. На странице релиза
  `isReleased`/`releaseAtMs` считаются в `getPageData`, а не в компоненте — иначе
  `react-hooks/purity` ругается на `Date.now()` в рендере.
- Любой внешний вход валидируется **zod до попадания в логику** (схемы в
  `packages/api-contracts`). UUID из URL — гард `isUuid` (`@vire/core`) до запроса,
  иначе Postgres кидает `invalid input syntax for type uuid` → 500 вместо 404.

## Репозиторий — границы

- Реализует интерфейс из `packages/core/src/repositories/*` (порт).
- Маппит строки Drizzle → доменные типы (`mapToRelease`, `mapRow`) — наружу не
  утекает форма таблицы.
- Гард синтаксиса id перед запросом по uuid-PK (`if (!isUuid(id)) return null`).

## FSD на фронте

```
app/ → pages/ → widgets/ → features/ → entities/ → shared/
```

Импорт только вниз по слоям. Публичный API слайса — только через `index.ts`.

## Чек-лист перед коммитом backend-изменения

- [ ] Логика — в `packages/core`, не в хендлере и не в репозитории.
- [ ] Сервис возвращает `Result`, хендлер маппит на HTTP-коды.
- [ ] Вход провалидирован zod / гардом; UUID-параметры через `isUuid`.
- [ ] `packages/core` не тянет Next/Drizzle напрямую.
- [ ] Гоняй гейты из CLAUDE.md: typecheck, lint, check:routes, test, build.
