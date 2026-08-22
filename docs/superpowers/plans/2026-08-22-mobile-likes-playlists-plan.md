# Инкремент 6 мобилки: лайки и добавление в плейлист — план

Дизайн: `docs/superpowers/specs/2026-08-22-mobile-likes-playlists-design.md`.

## Файлы

1. **`apps/mobile/lib/icon.tsx`** — добавить в `PATHS`/`IconName`:
   - `heart`: `translate: [-77, -317.14]`, `d: ['M106.05 325.761C105.412 325.122 104.654 324.615 103.819 324.27C102.985 323.924 102.091 323.746 101.188 323.746C100.284 323.746 99.3902 323.924 98.5558 324.27C97.7215 324.615 96.9635 325.122 96.325 325.761L95 327.086L93.675 325.761C92.3854 324.471 90.6363 323.747 88.8125 323.747C86.9887 323.747 85.2396 324.471 83.95 325.761C82.6604 327.05 81.9359 328.8 81.9359 330.623C81.9359 332.447 82.6604 334.196 83.95 335.486L85.275 336.811L95 346.536L104.725 336.811L106.05 335.486C106.689 334.847 107.195 334.089 107.541 333.255C107.887 332.421 108.065 331.526 108.065 330.623C108.065 329.72 107.887 328.826 107.541 327.992C107.195 327.157 106.689 326.399 106.05 325.761Z']`
     (путь замкнут `Z` — годится и для outline, и для filled состояния).
   - `plus`: `translate: [-77, -197]`, `d: ['M95 206.25V223.75', 'M86.25 215H103.75']`.
   - `check`: `translate: [-737, -376.38]`, `d: ['M765 387.5L751.25 401.25L745 395']`.
   - `Icon` компонент: добавить необязательный `filled?: boolean` — при `true` рендерить
     `<Path fill={color} stroke={color} .../>` вместо `fill="none"` (нужно для сердца
     в состоянии «лайкнуто»; для остальных иконок проп не задействован, дефолт `false`).

2. **`apps/mobile/lib/likes-store.ts`** (новый) — zustand-стор, зеркало
   `apps/web/store/likes.ts`, но через `apiRequest`:
   - `state: Record<string, boolean>`, `load(trackId)` (GET, пропуск если уже в сторе или
     уже летит), `toggle(trackId)` (module-level `_toggling: Set<string>` — no-op на повторный
     тап; оптимистично меняет `state`, шлёт `POST`/`DELETE` через `apiRequest`, откатывает
     при `!result.ok`).
   - Тесты: `lib/__tests__/likes-store.test.ts` — зеркалит то, что уже покрыто у
     `player-store.test.ts` по духу (мок `apiRequest`): load не дублирует запрос, toggle
     оптимистично меняет и откатывает на ошибке, повторный тап во время in-flight — no-op.

3. **`apps/mobile/lib/playlists.ts`** (новый, чистые API-обёртки, без стора — список
   плейлистов открывается на каждый шит заново, персистентный кэш не нужен):
   - `fetchPlaylistsForTrack(trackId)` → `apiRequest(GET /api/v1/playlists?trackId=...)`.
   - `addTrackToPlaylist(playlistId, trackId)` → POST.
   - `removeTrackFromPlaylist(playlistId, trackId)` → DELETE.
   - `createPlaylist(title)` → POST `/api/v1/playlists`.
   - Тесты: `lib/__tests__/playlists.test.ts` — маппинг на правильные URL/методы/тела
     (мок `apiRequest`, не сеть).

4. **`apps/mobile/components/like-button.tsx`** (новый) — `Pressable` с `Icon
   name="heart" filled={liked}`, читает/пишет через `useLikesStore`, `useEffect` на маунт
   вызывает `load(trackId)` (лениво, как `useLikesStore.load` уже устроен — не грузить,
   если уже в сторе), haptic-impact (`Haptics.ImpactFeedbackStyle.Light`) на тап. Не
   перехватывает тап трек-строки (`hitSlop`, отдельный `Pressable`, не вложенный в
   родительский без `onStartShouldSetResponder`).

5. **`apps/mobile/components/add-to-playlist-sheet.tsx`** (новый):
   - Триггер — кнопка с `Icon name="plus"` (открывает состояние `open`).
   - Модалка — `Modal` (`animationType="slide"`, `transparent`) + оверлей-`Pressable`
     (тап вне — закрыть) + панель снизу (`borderTopLeftRadius/borderTopRightRadius`,
     `SafeAreaView`/`useSafeAreaInsets` снизу).
   - На открытие — `fetchPlaylistsForTrack(trackId)`, список чекбоксов (`Icon
     name="check"` в квадрате при `inPlaylists.has(id)`, как у веба), тап — toggle
     (оптимистично + `addTrackToPlaylist`/`removeTrackFromPlaylist`, откат на ошибке).
   - Низ — `TextInput` + кнопка «Создать» (создание → сразу добавляет трек, как в
     `handleCreate` веба).
   - Haptic-impact на открытие/добавление, не на каждый чекбокс-toggle (см.
     «точечно — не на каждый тап» в `docs/features/mobile-app.md`).
   - Тесты: логика toggle/create как чистые функции там, где возможно вынести
     (`lib/playlists.ts` уже тестируется отдельно) — компонентный тест не обязателен
     (в мобилке нет `@testing-library/react-native`, паттерн проекта — тестировать стор/
     lib-слой, не рендерить компоненты, см. существующие `*-store.test.ts`/`*.test.ts`).

6. **Интеграция в экраны:**
   - `apps/mobile/screens/release-screen.tsx` → `TrackRow`: добавить `<LikeButton
     trackId={track.id} />` + `<AddToPlaylistSheet trackId={track.id} />` в конец строки
     (после `trackDuration`), не перехватывая `onPress` строки (play).
   - `apps/mobile/screens/home-screen.tsx` → `HotTrackRow`: то же самое, компактнее
     (нет отдельной колонки под номер трека — влезает после текста, перед/вместо
     плей-индикатора; сохранить видимость плей-индикатора при активном треке).

## Тесты и гейты

```
pnpm --filter @vire/mobile typecheck
pnpm --filter @vire/mobile test
pnpm --filter @vire/core typecheck   # порт не трогаем, но задели соседний пакет — подстраховка
```

## Живая проверка (эмулятор `VireMusic_Test`, окружение уже поднято)

- Открыть релиз/главную → тап на сердце → визуально заполняется, повторный тап —
  снимает; логи/сеть подтверждают POST/DELETE `.../like`.
- Тап на плюс → шит со списком плейлистов (реальные из БД тестового юзера) → тап на
  плейлист → чекбокс появляется, трек реально добавлен (перепроверить через веб или
  повторным открытием шита); создание нового плейлиста прямо из шита работает.
- Без крашей (`adb logcat` — 0 `FATAL EXCEPTION`).

## Документация

Обновить `docs/features/mobile-app.md` — новая секция «Инкремент 6: лайки и плейлисты»,
с тем же уровнем честности (что подтверждено фактом на эмуляторе, что нет).
