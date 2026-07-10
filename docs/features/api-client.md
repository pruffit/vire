# Типизированный API-клиент (`@vire/api-client`)

Общий слой для тоггл-эндпоинтов (подписка/лайк/пресейв) вместо разошедшихся
копий «оптимистично флипнуть → fetch → откатить и показать тост» по компонентам.

## Что делает

- `request<T>(url, { method, schema, body })` — обёртка над `fetch`, которая
  **никогда не бросает наружу**. Четыре исхода сведены к одному типу
  `ApiResult<T> = {ok:true; data:T} | {ok:false; error:{status, message}}`:
  сетевой сбой (`status: 0`), HTTP-ошибка (текст берётся из тела `{error}`,
  если сервер его прислал, иначе дефолт), ответ не прошёл zod-схему,
  либо успех — данные из схемы.
- `toggles.ts` — пять готовых вызовов под конкретные эндпоинты:
  `followArtist`, `likeTrack`, `likePlaylist`, `presaveRelease`,
  `presaveReleaseAsGuest`.
- `apps/web/lib/use-optimistic-toggle.ts` — хук `useOptimisticToggle` поверх
  `ApiResult`: оптимистично флипает флаг (+ опциональный счётчик), при
  `ok:false` откатывает оба и показывает тост, гардит повторный клик, пока
  предыдущий запрос не завершился.

Переведены на хук: `follow-button.tsx`, `like-button.tsx` (трек),
`use-playlist-like.ts`, `upcoming-presave-button.tsx`, и `toggleUser` в
`presave-button.tsx` (гостевая форма email — не тоггл, использует
`presaveReleaseAsGuest` напрямую ради серверного текста ошибки).

## Где код

- **Контракты ответов:** `packages/api-contracts/src/toggle.ts`
  (`followResponseSchema`, `likeResponseSchema`, `presaveResponseSchema`).
- **Клиент:** `packages/api-client/src/{result,http,toggles}.ts`.
- **Хук:** `apps/web/lib/use-optimistic-toggle.ts`.
- **Тесты:** `packages/api-client/src/__tests__/{http,toggles}.test.ts`,
  `apps/web/lib/__tests__/use-optimistic-toggle.test.ts`.

## Env

- Не требуется.

## Ограничения / на будущее

- **Узкий охват специально.** `@vire/api-client` покрывает только пять
  тоггл-эндпоинтов, ради которых он и был оживлён. В `apps/web` остаётся
  ~70+ сырых `fetch(` — массовая миграция не входит в объём этой задачи
  (диф вышел бы нерецензируемым); пакет — плацдарм для постепенного расширения.
- **Не зависит от `@vire/core`.** Пакет едет в браузерный бандл, поэтому
  `ApiResult`/`ApiError` определены локально в `packages/api-client/src/result.ts`,
  а не переиспользуют `Result<T,E>` из `packages/core` (доменные сервисы там не нужны).
- Добавить новый эндпоинт: завести схему ответа в `api-contracts/src/toggle.ts`
  (или отдельный файл, если это не тоггл), функцию-обёртку в `toggles.ts`
  через `request(url, { method, schema })`, при необходимости — использовать
  через `useOptimisticToggle`.
- `useOptimisticToggle` не умеет частично успешный ответ (например, тоггл
  прошёл, но счётчик с сервера разошёлся с локальным +1/-1) — считает
  локальный дельта-счётчик всегда верным при `ok:true`.
