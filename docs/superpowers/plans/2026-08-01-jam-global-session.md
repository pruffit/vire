# План — джем как глобальная сессия (01.08.2026)

Дизайн: `../specs/2026-08-01-jam-global-session-design.md`.

## 1. Стор активного джема — `apps/web/store/jam.ts` (новый)

```ts
interface ActiveJam { code: string; participantId: string; role: JamParticipantRole; sessionId: string | null }
```
State: `active: ActiveJam | null`, `audioEnabled: boolean`.
Actions: `activate(jam)` (ставит `audioEnabled: true`), `enableAudio()`, `leave()`.
Persist: `vire-jam`, localStorage, `partialize` → только `active`. `audioEnabled` не персистится.

Тест `store/jam.test.ts`: activate/leave/enableAudio, partialize не тащит audioEnabled.

## 2. Провайдер — `apps/web/components/jam/jam-session-provider.tsx` (новый)

`JamSessionProvider` (client): читает стор. Нет активного джема → отдаёт `null`-контекст
и **не** запускает хуки. Есть → рендерит внутренний `ActiveJamSession`, который переносит
из `jam-room.tsx` без изменения логики:

- `useJamRoom(code, sessionId)`, `useServerClock()`, `usePlaybackSync(...)`;
- `postPlayback`, `handleTogglePlayback`, `handleRowPlay`, `handleTrackEnded`,
  `handleModeChange`, `handleClaimSpeaker`, `handleEndJam`;
- optimistic `playbackPending` (весь блок с `resolvePending`/TTL) — переносить дословно;
- `resolvedSpeakerId` / `isAudioDevice` / `audioDeviceCount`;
- эффект `setPlayerJamOverride` + эффект `setJamTransport` с рефами;
- `jam:ended` → `leave()` в сторе + `toast`.

Контекст `JamSessionContext` (экспорт хука `useJamSession()` из этого же файла):
`{ code, membership, role, isHost, room, serverNow, isAudioDevice, speakerName, playbackPending,
isPlaying, activeTrackId, actions: { rowPlay, toggle, changeMode, claimSpeaker, endJam, leave } }`.

Условие override — активный джем + известный текущий трек, **без** зависимости от
`audioEnabled`; в override добавить `needsAudioGesture: !audioEnabled`
(`store/player.ts` → интерфейс `JamOverride`).

Монтаж: `apps/web/app/layout.tsx` — обернуть пару `<div id="main-content">…</div>` +
`<PlayerWrapper />` в `<JamSessionProvider>`. Разметку/классы шелла не трогать
(app-shell инвариант, `layout-shell.test.ts`).

## 3. Страница — `app/(listener)/jam/[code]/jam-room.tsx`

Убрать: membership-стейт, `useJamRoom`, `useServerClock`, `usePlaybackSync`, transport-эффекты,
override-эффекты, optimistic-playback блок. Оставить и переключить на контекст: очередь
(`useJamQueue` с `room.queue` и `room.setDragging` из контекста), DnD, `JamAddPanel`,
`JamParticipants`, шапка (режим/спикер/share/invite/save/end).

Три состояния:
1. активного джема нет **или** его `code ≠` кода страницы → `<JamJoin>`; `onJoin` шлёт
   `POST /join`, затем `controls.pause()` и `jamStore.activate(...)`;
2. `ended` → экран «Джем завершён»;
3. иначе — комната из контекста.

## 4. Мини-бар — `apps/web/components/player/mini-bar.tsx`

В `JamMiniBar`:
- бейдж «Джем»/«Пульт» → `Link href={/jam/${override.code}}` (тач-таргет ≥44px, `aria-label`
  «Вернуться в джем»);
- кнопка выхода (`Icon name="log-out"`) → `leave()`; на `<sm` не выкидывать — это
  единственный путь освободить плеер;
- play: `needsAudioGesture` → `enableAudio()` + `toggle()` только если джем на паузе,
  иначе прежний `jamToggle()`.

## 5. Сайдбар — `apps/web/components/listener/library-sidebar.tsx:53`

Свести отступы строки «Джем» к ритму остальных строк рельса (сейчас двойной `pt-2`).
Проверить оба состояния: свёрнутый рельс и развёрнутый сайдбар, гость и залогиненный.

## 6. Тесты

- `store/jam.test.ts` — см. §1.
- `components/jam/jam-session-provider.test.tsx` — **регресс на баг**: активный джем →
  размонтировать дочернюю страницу → `usePlayerStore.getState().jamOverride` не null и
  `getJamTransport()` не null; `jam:ended` чистит стор; после «F5» (стор с `active`,
  `audioEnabled=false`) override приходит с `needsAudioGesture: true`.
- `jam-room.test.tsx` — переписать на моки контекста вместо моков `useJamRoom`/
  `usePlaybackSync`; сохранить существующие проверки очереди/DnD/шапки.

## 7. Гейты

`typecheck` (web+core+db) · `lint` · `check:routes` · `test` · `audit:design` · `build`.

## Ограничения

- Комментарии — только неочевидное «почему», 1–2 строки. Никаких «что делает».
- `min-h-screen`/`h-screen` запрещены; скролл-область не превращать во flex-контейнер.
- Логику optimistic playback и drift-коррекции не переписывать — только переносить.
