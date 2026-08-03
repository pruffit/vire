# PWA + офлайн-медиатека — план

Дизайн: `docs/superpowers/specs/2026-08-03-pwa-offline-design.md`.
Срезы идут последовательно: 2 опирается на кэши и SW из 1, 3 — на ядро из 2.

## Срез 1 — SW, установка, офлайн-фолбэк

- `apps/web/public/sw.js` — к существующим `push`/`notificationclick` добавить `install`
  (precache `/offline` + иконки), `activate` (снос чужих версий кэшей + `clients.claim`),
  `fetch` (таблица стратегий из спеки), `message` (`SKIP_WAITING`, `PURGE_ALL` для
  kill-switch). Чистые функции (`strategyFor`, `trimCache`) экспортировать через
  `self.__test`, чтобы Vitest мог их импортировать.
- `apps/web/components/service-worker-registrar.tsx` — регистрация `/sw.js` c
  `updateViaCache: 'none'` после `load`, `ssr: false`. Подключить в `DeferredWidgets`
  (`components/deferred-widgets.tsx`) — там уже собраны отложенные клиентские виджеты.
- `apps/web/lib/push-client.ts` — `subscribeToPush` перестаёт регистрировать SW сам,
  ждёт `navigator.serviceWorker.ready` (регистрация теперь общая); сохранить fallback-
  регистрацию, если готовности нет.
- `apps/web/app/manifest.ts` — `id`, `scope`, `orientation`, `categories`, `shortcuts`
  (Поиск / Медиатека / Скачанное), maskable-иконка.
- `apps/web/scripts/make-maskable-icon.mjs` — разовая генерация `public/icon-maskable-512.png`
  из `icon-512.png` через `sharp` (safe-zone ~20% полей). Результат коммитится, скрипт не
  в билд-цепочке.
- `apps/web/app/offline/page.tsx` — каркас страницы (статическая, без auth и серверных
  данных, иначе не отдастся офлайн). Наполнение — в срезе 3.
- `apps/web/next.config.ts` — в `headers()` добавить source `/sw.js` с
  `Cache-Control: no-cache, must-revalidate`.
- Тест `apps/web/lib/offline/sw.test.ts` — импорт `public/sw.js` с подменённым
  `globalThis.self`: покрыть выбор стратегии по URL (навигация, `_next/static`, картинка,
  манифест трека, HLS, API) и подрезку кэша по лимиту.

## Срез 2 — ядро офлайн-медиатеки

- `apps/web/lib/offline/hls.ts` — `parseHlsSegments(playlistText, manifestUrl)`: строки без
  `#`, разрешение относительных URL через `new URL(line, manifestUrl)`. Чистая, покрыта тестами.
- `apps/web/lib/offline/db.ts` — IndexedDB `vire-offline`, store `tracks` (keyPath `id`):
  `get/getAll/put/delete`. Тонкая обёртка на промисах, без библиотек.
- `apps/web/lib/offline/download.ts` — оркестрация: манифест трека → `.m3u8` → сегменты
  пачками (≤4 параллельно) с колбэком прогресса и `AbortSignal`; всё пишется в кэш
  `vire-offline` через `caches.open`. Чистая `planDownload(segmentUrls, cachedUrls)` —
  что осталось докачать (докачка `partial`-записей). `removeDownload(trackId)` — снос
  записей из кэша и реестра. `estimateUsage()` поверх `navigator.storage.estimate()`.
- `apps/web/store/offline.ts` — zustand по образцу `store/likes.ts`: карта
  `trackId → 'idle' | 'downloading' | 'done' | 'partial'`, прогресс, guard от повторного
  запуска (module-level `Set` in-flight, как в лайках), гидрация из IDB при первом обращении.
- Тесты: `hls.test.ts`, `download.test.ts` (на `planDownload` и разбиение на пачки — с
  фейковыми `fetch`/`caches`).

## Срез 3 — поверхности

- `apps/web/components/track-queue-menu.tsx` — третий пункт: «Сохранить офлайн» /
  «Удалить из офлайна» (по состоянию из стора), с прогрессом в лейбле. Новых меню не заводить —
  `AdaptiveMenu` уже даёт sheet на таче и поповер на десктопе.
- `apps/web/app/(listener)/playlists/[id]/` — кнопка «Скачать плейлист» (последовательная
  постановка треков в очередь загрузки, общий прогресс).
- `apps/web/app/offline/page.tsx` — полноценный экран: список скачанного (переиспользовать
  `TrackRow`), запуск воспроизведения через `controls.playQueue`, занятое место, удаление,
  «сбросить кэш приложения» (kill-switch), состояние «нет сети».
- `apps/web/app/(listener)/library/page.tsx` — плитка «Скачанное» рядом с плиткой «Джем».
- `apps/web/components/install-app-button.tsx` — перехват `beforeinstallprompt`, кнопка в
  медиатеке; прячется, если приложение уже установлено (`display-mode: standalone`).
- Гейт `audit:design` обязателен — трогаем UI.

## Срез 4 — документация и выкатка

- `docs/features/pwa-offline.md` — что делает, где код, стратегии кэша, ограничения
  (iOS-нативный HLS, Яндекс Браузер без WebAPK, статистика офлайн-прослушиваний теряется).
- Обновить `docs/features/mobile-patterns.md` (ограничение про браузерный хром — частично
  снято установкой) и `docs/roadmap/stage-2.md` §10.1.
- Гейты: typecheck / lint / check:routes / test / audit:design / build.
- Версия в двух `package.json` (корень + `apps/web`), коммит. Тег и деплой — по команде Danya.

## Риски

- SW может «залипнуть» на сломанной версии у пользователя — отсюда `PURGE_ALL` и кнопка
  сброса на `/offline`; `activate` всегда сносит кэши чужих версий.
- Приватность: HTML не кэшируется вообще (см. спеку) — проверить, что в `fetch` нет ветки,
  кладущей документ в кэш.
- Проверка в браузере обязательна: гейты SW не ловят (тот же класс, что рантайм-баги из
  CLAUDE.md). Ручной прогон — DevTools → Application: установка, офлайн-режим, воспроизведение
  скачанного при выключенной сети.
