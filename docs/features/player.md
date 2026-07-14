# Глобальный плеер

Постоянный плеер в app-shell (поток снизу, `h-16`, появляется только когда есть трек).
Воспроизводит треки через HLS, переживает перезагрузку страницы, поддерживает очередь,
волну, waveform-скраббер, горячие клавиши.

## Что делает

### Архитектура

- **Стор:** Zustand (`usePlayerStore`) — трек, очередь, индекс, громкость, прогресс,
  режим волны/шаффла/повтора, контекст источника. Персистится в `localStorage` под ключом
  `vire-player` (версия 1): трек, очередь (усечена до 100, окно вокруг текущего индекса —
  `sliceWindowAroundIndex`, 20 треков назад), `originalQueue` (шаффл-бэкап) — тем же
  окном, по позиции текущего трека в ней, индекс, громкость, режим волны/шаффла/повтора,
  контекст, `currentTime`, `duration`. При регидрации выставляется `restored: true` —
  плеер показывает трек/позицию **и длительность** (не 0:00/0:00), но ещё не подключён
  к `<audio>`; первый клик play вызывает `controls.resumeRestored()`, который догружает
  манифест и продолжает с сохранённой позиции (`clampRestoredQueueIndex` чинит индекс,
  если очередь была усечена; `attachAndPlay` при резюме не сбрасывает `duration` в 0,
  как делает при обычном старте нового трека).
- **Движок** (`lib/player/audio-engine.ts`) — модуль вне React с одним `<audio>`
  и одним `hls.js` на вкладку; `controls.*` — единственная точка мутации стора для
  воспроизведения (`playQueue`, `toggle`, `togglePlay`, `seek`, `next`/`prev`,
  `toggleShuffle`, `startWave`/`stopWave`, `resumeRestored`). LRU-кэш HLS-манифестов
  на 10 треков + in-flight-дедуп (`lib/player/manifest-cache.ts`), префетч манифеста
  следующего трека за 15с до конца текущего, watchdog загрузки (20с → ошибка вместо
  вечного спиннера), staleness-guard (переключение трека во время висящего fetch не
  даёт устаревшему ответу перезаписать стор).
- **Единый вход:** `usePlay()` (`lib/player/use-play.ts`) — `playQueue`/`toggle`/
  `isCurrent`/`isPlaying` для компонентов; `useLazyQueue(kind, id, meta)` — ленивая
  загрузка треков релиза/плейлиста для quick-look/featured с общим in-flight-промисом.
  `PlayContext` (`{ source, sourceId }`, `PLAY_SOURCES` из `@vire/api-contracts`)
  передаётся на каждый `playQueue` — используется в `/api/v1/tracks/[id]/play` для
  аналитики источника; практически все ~18 точек запуска в приложении (трек-листы,
  featured, quick-look, лайкнутое, плейлисты, покупки, поиск, wave-старт) идут через
  `usePlay`/`controls.playQueue`.
- **Живое время:** `useAudioTime(fps, enabled)` (`lib/player/use-audio-time.ts`) читает
  `audio.currentTime` напрямую мимо стора через rAF — ре-рендерится только сам
  подписавшийся лист (скраббер/лирика), а не всё дерево плеера. `enabled=false`
  (неактивный трек в списке) не крутит rAF вовсе и не пересинхронизируется. Стор
  хранит `currentTime` только редким тиком (~5с, `runThrottledTick`) — для персиста,
  не для UI.
- **Waveform:** единый `WaveformScrubber` (`components/player/waveform-scrubber.tsx`) —
  бары из `track_audio.waveform_peaks`, поддерживает маркеры любимых моментов,
  клик/drag/стрелки для перемотки, `active=false` рендерит некликабельный вид с
  единственным `onActivate` (переключиться на этот трек).
- **HLS:** `hls.js` подгружается динамически при первом воспроизведении (не в
  начальном бандле); повышенная терпимость к «дырам» в буфере
  (`maxBufferHole: 0.5`, `nudgeMaxRetry: 8`) — часть исходников даёт gap у начала.

### UI-декомпозиция (`components/player/`)

- `index.tsx` — координатор: показывает `MiniBar` в потоке app-shell + `FullscreenPlayer`
  оверлеем поверх, ничего сам не рисует.
- `mini-bar.tsx` — компактная панель: обложка, тайминги, верхняя прогресс-линия
  (полноширинная, отдельно от waveform), кнопка очереди, `Controls`. Скраб-зона
  прогресс-линии — `z-20` (выше контента бара, `z-10`) — раньше контент перекрывал её
  и перемотка мимо кнопок транспорта не срабатывала; на десктопе hover утолщает линию
  и показывает плейхед. На `<sm` рядом с кнопкой очереди в фуллскрине появляется своя
  кнопка очереди в мини-баре (`MobileQueueButton`, `sm:hidden`) — раньше очередь на
  мобилке открывалась только через фуллскрин.
- `fullscreen.tsx` — полноэкранный плеер: OKLCH-градиент фона из акцентного цвета
  трека, лирика, waveform-скраббер, `Controls` с шаффлом. Свайп-закрытие — только
  с явных drag-зон (`useDragControls` + `dragListener={false}`, как в
  `quick-look-sheet.tsx`): полноширинная ручка сверху и обложка. Контейнерного
  drag нет намеренно: он вешал `touch-action: pan-x` на весь фуллскрин и убивал
  тач-скролл контента на невысоких экранах.
- `controls.tsx` — транспорт (prev/play-pause/next) + `WaveModeButton`/`ShuffleButton`;
  `PlayPauseButton` в `restored`-состоянии не дёргает несуществующий `<audio>` — жмёт
  `resumeRestored()`.
- `queue-panel.tsx` — панель «Дальше»: drag-to-reorder (`motion/react` `Reorder`),
  переход по клику; в режиме волны разделитель «Дальше — Волна» перед треками,
  добавленными буфером (после исходно запущенной очереди).
- `track-links.tsx` — ссылки на артиста/релиз из названия трека.
- `player-icons.tsx` — иконки, специфичные для плеера (волна, очередь, grip и т.п.).
- `use-player-hotkeys.ts` — горячие клавиши.

### Горячие клавиши

| Клавиша | Действие |
|---|---|
| `Space` | Play / Pause |
| `←` / `→` | -5с / +5с |
| `M` | Mute toggle |
| `R` | Режим повтора (off → all → one → off) |
| `F` | Favourite (любимый момент) |
| `↑` / `↓` | Громкость ±10% |

### Очередь

- Добавить трек / релиз / плейлист / результаты волны — `controls.playQueue(tracks, opts)`,
  дедуп по id (`lib/player/queue.ts`), честный Фишер-Йетс шаффл с сохранением исходного
  порядка (`originalQueue`) для выключения.
- Навигация: `prev` (после 3с — перемотка в начало текущего трека, не переход),
  `next`.
- Панель «Дальше» — drag-to-reorder, переход по клику на трек.
- Вставка в живую очередь — `controls.enqueue(tracks, 'next' | 'end', context)`
  (чистая `insertIntoQueue` в `lib/player/queue.ts`): треки, уже стоящие в очереди,
  повторно не вставляются (возврат 0 → тост «Уже в очереди»); при shuffle вставка
  зеркалится в `originalQueue`; после вставки очередь капается `capLiveQueue`;
  при пустом плеере ведёт себя как `playQueue`. UI-вход — `TrackQueueMenu`
  (`components/track-queue-menu.tsx`, кебаб на строках главной и в peek-шите
  релиза, см. [home-feed](home-feed.md)).

### Повтор

`repeat: 'off' | 'all' | 'one'` (`RepeatButton`, бейдж «1» в режиме `one`; в мини-баре
на `sm+` и в фуллскрине; хоткей `R` циклит `off → all → one → off`). Spotify-семантика:
- `one` срабатывает только на естественном окончании трека (`ended`) — перематывает на 0
  и продолжает играть тот же трек; **ручной `next()` повтор пропускает** — идёт к
  следующему треку как при `off` (`nextQueueIndex` не обрабатывает `'one'` вовсе —
  залипание на треке живёт только в обработчике `ended` в `audio-engine.ts`).
- `all` заворачивает очередь на индекс 0 — но только когда **не** `waveMode`: волна
  приоритетнее и сама дозапрашивает буфер вместо зацикливания (см. ниже).
- Чистая функция `nextQueueIndex(queueIndex, queueLength, repeat)` в `lib/player/queue.ts`.

### Wave-режим (авто-плей)

`waveMode=true` — движок дозапрашивает буфер волны (`GET /api/v1/wave`, см.
[wave.md](wave.md)), когда в очереди остаётся ≤2 трека после текущего
(`needsWaveFetch`); при исчерпании очереди на реальном `next()` — реактивный фолбэк.
Ошибка загрузки волны 3 раза подряд гасит режим и показывает `audioError` вместо
бесконечных попыток. `waveSeed` (`{ mood?, genre? }`) хранит seed, с которым запущена
текущая волна — подсвечивает активный чип на главной, не персистится (сессионный).

## Где код

- **Стор:** `apps/web/store/player.ts` (Zustand + persist)
- **Движок:** `apps/web/lib/player/audio-engine.ts`
- **Единый вход:** `apps/web/lib/player/use-play.ts`, `lib/player/lazy-queue-fetchers.ts`
- **Живое время:** `apps/web/lib/player/use-audio-time.ts`
- **Манифест-кэш:** `apps/web/lib/player/manifest-cache.ts`
- **Буфер волны:** `apps/web/lib/player/wave-buffer.ts`
- **Очередь/шаффл:** `apps/web/lib/player/queue.ts`
- **Маппинг в PlayerTrack:** `apps/web/lib/player/to-player-track.ts`,
  `lib/player/liked-to-player-track.ts`
- **Компоненты:** `apps/web/components/player/index.tsx`, `mini-bar.tsx`,
  `fullscreen.tsx`, `controls.tsx`, `queue-panel.tsx`, `waveform-scrubber.tsx`,
  `track-links.tsx`, `player-icons.tsx`, `lyrics.tsx`, `use-player-hotkeys.ts`
- **Zod-схемы источника:** `packages/api-contracts/src/wave.ts` (`PlaySource`,
  `PLAY_SOURCES`)
- **API манифеста:** `apps/web/app/api/v1/tracks/[id]/manifest/route.ts` — rate limit
  60 req/мин на IP; отдаёт манифест только играбельным трекам
  (`getPlayableTrackAudio`: READY + релиз вышел + артист активен) либо
  владельцу-артисту/staff (`MODERATOR`/`ADMIN`/`SUPERADMIN`) через `getTrackAudio`
- **Play-события:** `apps/web/app/api/v1/tracks/[id]/play/route.ts` (rate limit
  40 req/мин), heartbeat присутствия — `apps/web/app/api/v1/tracks/[id]/listening/route.ts`
  (rate limit 12 req/мин), см. [live-presence.md](live-presence.md)
- **HLS-утилиты:** `packages/media/src/hls.ts`

## Env-переменные

```
S3_PUBLIC_ENDPOINT=             # базовый URL для построения ссылок на HLS-манифест
S3_BUCKET_STREAM=               # бакет со стрим-сегментами
REDIS_URL=                      # rate-limit медиа-эндпоинтов
```

## Известные ограничения

- Только HLS — прямые mp3/flac-ссылки не используются.
- `hls.js` не поддерживается в Safari ≤ 9 (там нативный HLS через `<video>`).
- Waveform-пики вычисляются воркером при транскодинге; если воркер не запущен — пики
  отсутствуют, скруббер показывает плейсхолдер (sine-fallback).
- Персист хранит только последние 100 треков очереди (и `originalQueue`) окном вокруг
  текущего индекса — очень длинные волны обрезаются при перезагрузке; сама волна
  продолжит подбор с текущего трека. Live-очередь в памяти (без персиста) капается
  отдельно на 300 треков (`capLiveQueue`, `LIVE_QUEUE_LIMIT`) той же оконной логикой.
- `waveSeed` не персистится — после перезагрузки страницы активный чип на главной не
  подсвечен, даже если волна продолжает играть.
- **Громкость — только на десктопе.** Ползунок показывается лишь на устройствах с
  мышью/трекпадом; на планшетах и телефонах скрыт (там громкость на хардварных кнопках,
  а на iOS `audio.volume` ещё и read-only). Детект — `lib/is-desktop-pointer.ts` по
  медиа-запросу `(hover: hover) and (pointer: fine)`, НЕ по userAgent (иначе врёт в
  iOS-вебвью). Касается обоих ползунков — фуллскрин и десктоп-бар. Когда ползунок скрыт,
  в фуллскрине строка центрирует share (без него слева зияла пустота).
