# Вечеринка: юзабилити-проход (экран, визуализатор, мобильный поиск, ссылки)

Дата: 03.08.2026. Четыре независимых среза, идут параллельно.

## Проблемы (с диагнозом)

1. **Видео перекрывает UI.** `PartyVideoDock` — `fixed bottom-20 right-3 z-40`, 200px, поверх
   всего и на экране вечеринки, и в комнате. Переносить iframe по DOM нельзя (перезагрузится,
   звук порвётся) — поэтому док обязан оставаться в app-shell.
2. **Экран вечеринки неудобен.** Витрина = квадрат обложки + текст + QR; видео при этом
   рисуется в углу поверх неё. Нет прогресса, нет крупных контролов, нет anti-sleep.
3. **Нет визуализатора.** Просят абстрактные фигуры/спирали как в старых плеерах.
4. **Мобильный поиск вслепую.** Панель добавления живёт в bottom-`Sheet` (`fixed inset-0`,
   `max-h-85vh`) + `autoFocus`: клавиатура открывается, layout viewport не сжимается, поле
   ввода и список уезжают под клавиатуру.
5. **Ссылки.** Spotify отдаёт боту `302 → accounts.spotify.com/login` (гео + бот-UA) —
   `fetchPageMeta` возвращает null. Apple Music отдаёт SPA-шелуху (`og:title` = «Apple Music
   Web Player»). Deezer: `www.deezer.com` → `302 /soon`. Проверено запросами.
   Работают официальные эндпоинты: `open.spotify.com/oembed`, `itunes.apple.com/lookup?id=`,
   `api.deezer.com/track/{id}`.

## Срез A — резолв ссылок по провайдерам

Каскад не меняется; меняется шаг «метаданные страницы»: перед общим скрейпом пробуем
официальный эндпоинт провайдера.

- `packages/core/src/services/external-resolve.ts`: чистая `parseProviderTrackUrl(url)` →
  `{ provider: 'spotify' | 'apple-music' | 'deezer'; id: string } | null`
  (spotify `/track/{id}`, apple `?i={id}` либо `/song/{slug}/{id}`, deezer `/track/{id}`
  с любым языковым префиксом). Экспорт из `packages/core/src/index.ts`. Тесты — рядом.
- `apps/web/lib/external/providers.ts`: `fetchProviderMeta(url): Promise<PageMeta | null>`
  — фиксированные эндпоинты (пользовательский URL только в query/по id, SSRF не применим):
  spotify → oEmbed (title + thumbnail, артиста нет), apple → iTunes Lookup
  (`trackName`/`artistName`/`artworkUrl100`→600x600/`trackTimeMillis`), deezer → `api.deezer.com`.
- Обогащение артиста для Spotify: `enrichArtist(meta)` — если `artistName` пуст, дёрнуть
  метаиндекс (iTunes+Deezer, уже есть) по названию и взять артиста ТОЛЬКО при точном
  совпадении `normalizeQueryKey('', title)`; иначе оставить пусто.
- Подключение в `lib/external/index.ts`: `fetchProviderMeta` → при null `fetchOembed`/`fetchPageMeta`.
- Обложки: добавить `spotifycdn.com` в `cover-hosts.ts`, `img-src` (`next.config.ts`) и
  `images.remotePatterns` — три места синхронны.

## Срез B — мобильный ввод (поиск в панели добавления)

- `apps/web/lib/use-keyboard-inset.ts`: подписка на `window.visualViewport`
  (`resize`+`scroll`), возвращает высоту перекрытия клавиатурой; 0 при отсутствии API/SSR.
- `components/sheet.tsx`: панель поднимается на этот отступ (`paddingBottom`/`bottom`) и
  ограничивается по доступной высоте — правится один раз для всех нижних шторок.
- `party-add-panel.tsx`: поле ввода липкое сверху шторки, шрифт ≥16px на мобилке (иначе iOS
  зумит), `inputMode="search"`, `enterKeyHint="search"`, `autoCapitalize/autoCorrect/spellCheck` off,
  крестик очистки, явная кнопка отправки на узком экране, `autoFocus` — после анимации шторки.
  Пустой/загрузочный статус виден без скролла.

## Срез C — экран вечеринки + докинг видео

- `lib/jam/sources/video-slot.ts`: регистр слота (`setPartyVideoSlot(el)`, подписка) —
  тот же паттерн, что `video-container.ts`. Слот — обычный React-узел на странице; iframe
  в него НЕ переносится.
- `party-video-dock.tsx`: остаётся в app-shell, всегда смонтирован; позиционируется по
  прямоугольнику зарегистрированного слота (ResizeObserver + `resize`/`scroll` + rAF-сверка,
  только пока док видим). Слота нет → компактный PiP в углу (≥200×200, ToS), не перекрывающий
  плеер и таб-бар.
- `party-screen.tsx` — редизайн витрины: сцена (видео-слот для YOUTUBE/SOUNDCLOUD, иначе
  обложка/визуализатор), крупные контролы (play/pause, пропуск с голосами), прогресс,
  «дальше», QR, выход, `navigator.wakeLock` пока экран открыт. Мобилка и ТВ — один лейаут,
  без `h-screen`/`min-h-screen`.
- В комнате на звуковом устройстве — свой слот в шапке, чтобы видео не висело поверх очереди.

## Срез D — визуализатор

- `components/visualizer/` — canvas-компонент, пресеты «спираль», «плазма», «частицы» (+ выкл),
  цвет из акцента текущей позиции, амплитуда из `waveform_peaks` (через `fetchManifest`,
  уже кэшируется) для VIRE-позиций, иначе процедурная огибающая. Web Audio не трогаем —
  тракт воспроизведения не переключаем.
- rAF, DPR ≤1.5, пауза при `document.hidden`, `prefers-reduced-motion` — статичный кадр.
- Выбор пресета в localStorage; переключатель на экране вечеринки.

## Гейты

typecheck (web/core/db), lint, check:routes, test, audit:design, build. Фичедок — `docs/features/party.md`.
