---
name: vire-testing
description: Use when writing or reviewing tests in VireMusic — unit tests for packages/core services, route-handler permission/validation tests, pure-function tests (format, structured-data, lrc, upload), worker pipeline tests, or the app-shell layout invariant. Covers Vitest setup, TDD workflow, what to test at each layer, how to mock repositories vs inject fakes, and which gates to run. Use when deciding test strategy, fixing a failing test, or asking why something isn't covered.
version: 1.0.0
user-invocable: true
---

# VireMusic — тестирование (Vitest / TDD)

Раннер — **Vitest**. Гонять: `pnpm --filter @vire/web test` (web),
`pnpm --filter @vire/core test`, `pnpm --filter @vire/worker test`.
Сейчас в `apps/web` ~200 тестов — держи зелёными.

## Что тестируем на каждом слое

| Слой | Что покрывать | Как |
|------|---------------|-----|
| `packages/core` сервисы | бизнес-правила, права, ветки Result | мок-репозиторий (`vi.fn()`), без БД |
| Route handlers | права + валидация входа | мок сервиса/сессии, проверка статус-кодов |
| Чистые функции (`lib/*`) | вход→выход | прямые ассерты, без моков |
| `apps/worker` | пайплайн транскода, waveform | чистые функции + интерфейсы за моками |
| Инварианты | app-shell layout (нет `min-h-screen`) | `app/__tests__/layout-shell.test.ts` |

## Паттерн: тест сервиса через мок-репозиторий

`packages/core/src/__tests__/services/release.test.ts`:

```ts
const makeRepo = (over) => ({
  findById: vi.fn(), findWithTracks: vi.fn(), delete: vi.fn(),
  updateStatus: vi.fn(), findAllByArtist: vi.fn(),
  findPublishedByArtist: vi.fn(), create: vi.fn(), update: vi.fn(),
  ...over,                                  // переопределяем нужный метод
});

it('возвращает NotFoundError, если релиза нет', async () => {
  const repo = makeRepo({ findWithTracks: vi.fn().mockResolvedValue(null) });
  const result = await new ReleaseService(repo).getWithTracks('non-existent');
  expect(result.ok).toBe(false);
});
```

⚠️ Если добавил метод в интерфейс репозитория — **обнови `makeRepo`**, иначе моки
отстанут от порта (так уже ловили: добавляли `delete`/`updateStatus`).

## TDD-цикл для новой бизнес-логики

1. **Red**: тест на сервис с мок-репо — опиши ожидаемый `Result` (ok / конкретная
   ошибка). Запусти, убедись что падает.
2. **Green**: минимальная реализация в `packages/core`, чтобы тест прошёл.
3. **Refactor**: вынеси чистые части в отдельные функции, покрой их прямыми тестами.
4. Хендлер тестируй отдельно — только права и маппинг ошибок в статус-коды.

## Регресс-тесты на инциденты

Каждый прод-баг закрывай тестом с реальными данными инцидента. Пример: битый UUID
из обрезанной ссылки → `isUuid('f442053f-...-9181855a1a2')` === false
(`apps/web/lib/__tests__/upload.test.ts`). Это дешевле, чем второй раз ловить 500.

## Гейты качества (после каждого набора изменений)

```
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes   # инвариант роутинга (слаг-конфликты)
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design   # Impeccable — равноправный гейт
pnpm --filter @vire/web build
```

⚠️ **typecheck/lint/test/build НЕ ловят рантайм-баги старта** (слаг-конфликт уронил
прод v1.0.70). Их ловят `check:routes` + standalone-smoke в CI (`deploy.yml`, job
`gates`). Новые динамические сегменты называй как соседние (`[releaseId]`, не `[id]`).
