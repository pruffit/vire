# Инкремент 6 мобилки: лайки и добавление в плейлист — дизайн

## Проблема

С мобилки нельзя лайкнуть трек или добавить его в плейлист — на вебе оба действия
стабильны с самого начала, на мобилке их просто нет ни на одном экране.

## Решение

Переиспользовать существующие API `/api/v1/tracks/[id]/like` и `/api/v1/playlists*`
(тот же контракт, что и веб) через `apiRequest()` (Bearer + refresh, уже есть в мобилке).
Два новых UI-примитива на трек-строку:

1. **Лайк** — сердце-иконка рядом со строкой трека, тап = toggle с haptic-impact и
   оптимистичным UI (мгновенно меняет состояние, откатывает при ошибке сети — тот же
   паттерн, что `apps/web/store/likes.ts`: module-level `Set` для защиты от двойного тапа
   до ответа сети).
2. **Добавить в плейлист** — кнопка (плюс-иконка) открывает bottom sheet со списком
   плейлистов пользователя (чекбоксы, toggle по тапу) + поле создания нового плейлиста
   внизу — 1:1 логика `apps/web/components/add-to-playlist-button.tsx`, без визуальных
   вариаций под артист-тему (той у мобилки нет).

Оба контрола — на `ReleaseScreen` (трек-лист релиза) и `HomeScreen` (блок «В топе»).

## Из чего строим (переиспользование)

- `apps/mobile/lib/api-client.ts` → `apiRequest()` — Bearer/refresh уже реализован.
- `@vire/api-contracts`: `likeResponseSchema` (`{liked}`), `playlistListResponseSchema`
  (`{playlists, inPlaylists}`), `createPlaylistResponseSchema` (`{id}`),
  `addPlaylistTrackSchema` (`{trackId}`) — те же схемы, что веб.
- Эндпоинты (идентичны вебу, см. `apps/web/store/likes.ts` и `add-to-playlist-button.tsx`):
  - `GET/POST/DELETE /api/v1/tracks/{id}/like` → `{liked}`
  - `GET /api/v1/playlists?trackId={id}` → `{playlists, inPlaylists}`
  - `POST /api/v1/playlists/{id}/tracks` body `{trackId}`
  - `DELETE /api/v1/playlists/{id}/tracks/{trackId}`
  - `POST /api/v1/playlists` body `{title}` → `{id}` (создание нового прямо из шита)
- Паттерн стора — `apps/mobile/lib/player-store.ts` (zustand, module-level guard'ы,
  race-safety на устаревший ответ).
- Иконки — `apps/mobile/lib/icon.tsx` (свой SVG-рендерер поверх `react-native-svg`,
  paths 1:1 из `apps/web/public/icons/system-sprite.svg`). Нужны `heart`, `plus`, `check`
  — точные path/translate уже извлечены из спрайта (см. план).
- Bottom sheet — в мобилке готового примитива шита нет (в отличие от веба, `components/
  sheet.tsx`); новый маленький модальный компонент на `react-native` `Modal` +
  `Pressable`-оверлей, без сторонних зависимостей (тот же принцип, что кастомный
  PanResponder-слайдер в инкременте 3 — не тащить лишний пакет ради одного шита).

## Вне скоупа

Создание/переименование/удаление плейлистов вне контекста «добавить трек» (экран
«Медиатека» остаётся заглушкой), просмотр содержимого плейлиста, лайк/добавление из
экрана трека (страницы трека на мобилке ещё нет — есть только релиз/главная).
