# QA-батч 05.07.2026 — план

Источник: ручной QA пользователя (9 пунктов). Маппинг кода выполнен сабагентами.

## Workstream A — скроллбары и лимиты главной (web, не трогает player/*)

1. **Горизонтальные скроллбары** под пилюлями Потока и каруселями — убрать.
   - Новый утилити-класс `.no-scrollbar` в `apps/web/app/globals.css`
     (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`).
   - Применить: `components/home/wave-chips.tsx:47`, `components/home/cover-rail.tsx:17`,
     карусель «Новое у подписок» `app/(listener)/page.tsx:113`, прочие overflow-x-auto ленты.
   - Заменить дубли `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` в
     `side-nav.tsx:36`, `artist-catalog.tsx:75` на `.no-scrollbar` (не плодить дубли).
   - Глобально: `::-webkit-scrollbar-button { display:none }` (стрелки на Windows).
2. **Лимиты секций** `app/(listener)/page.tsx`: «Свежие релизы» — это лимит (rest≤8 от
   `getLatestReleases(13)`), поднять до hero+18; публичные подборки 8 → 12.

## Workstream B — мобильные жесты плеера (components/player/*, quick-look-sheet)

3. **Очередь: скролл vs drag** (`player/queue-panel.tsx`): Framer `Reorder.Item` →
   `dragListener={false}` + `useDragControls`, drag стартует только с grip-ручки
   (`onPointerDown={e => controls.start(e)}`, `touch-action:none` на ручке; на мобиле
   ручка крупнее — hit-area ≥40px). Список скроллится свободно.
4. **Двойной вертикальный скроллбар очереди**: убрать вложенный overflow
   (`player/fullscreen.tsx:145-156` + контейнер `queue-panel.tsx:37`), скролл — только
   у списка; учесть `scrollbar-gutter:stable` от `[data-scroll-area]`.
5. **LRC-текст**: контейнер `lyrics-scroll` — `overscroll-contain`, `touch-action:pan-y`,
   fade-маски сверху/снизу (mask-image) как явная граница зоны скролла, на мобиле выше
   (`max-h`), drag фуллскрина при открытом тексте уже отключён — проверить.
6. **Bottom-sheet предпросмотра** (`quick-look-sheet.tsx`): drag="y" всей шторки глушит
   нативный скролл (motion ставит touch-action:none). → `dragListener={false}` +
   `useDragControls`, свайп-закрытие только за верхнюю зону (grabber-полоска + шапка),
   список скроллится нативно; `overscroll-contain` на списке.

## Workstream C — stale-очередь релиза (lib/player/use-play.ts)

7. `useLazyQueue`: `cacheRef`/`inflightRef`/`items` не сбрасываются при смене `id` →
   играет очередь прошлого релиза. Сброс по смене `kind:id` (ключ в ref), тест.

## Workstream D — правовые страницы (app/(listener)/terms, privacy)

8. Актуализация под фактический функционал (из аудита БД/кода): лайки плейлистов,
   пресейвы (email гостя + письмо в день релиза), профиль вкуса Волны (агрегация
   прослушиваний/лайков), live-присутствие (анонимный sessionId, Redis, окно 45с),
   смартлинки, localStorage `vire-player`, rate-limit по IP (Redis). Провайдеры входа:
   только Яндекс + email (пароль/magic-link через Brevo). Дата редакции 05.07.2026.

## Workstream E — авто-жанр (worker + db + dashboard)

9. Классификатор **discogs-effnet (ONNX)**: мел-спектрограмма essentia.js (WASM,
   TensorflowInputMusiCNN) → embeddings + genre_discogs400 через `onnxruntime-node`.
   - Джоба в transcode-пайплайне после READY-анализа, фича-флаг `AUTO_GENRE`,
     сбой классификации НЕ блокирует READY.
   - Маппинг Discogs-400 → наш `genreEnum` (lookup-таблица).
   - БД: `track_audio.genre_suggestions` JSONB `[{genre, confidence}]` (миграция).
   - Политика: если у трека нет `track_genres` — авто-применить топ-2 с conf≥порога;
     артист всегда может поменять. GenrePicker показывает «Предложено: …».
   - Модели (~20МБ) не в git: скрипт скачивания с essentia.upf.edu + Docker build-step.
   - ⚠️ Лицензия моделей MTG — CC BY-NC-ND: ок пока некоммерческий этап; до Этапа 2
     запросить коммерческую лицензию у MTG или перейти на Musiio API (~$0.07/трек).
   - RAM-бюджет 1ГБ VPS: инференс по фрагменту (до 2 мин, 16кГц моно), последовательно.

## Гейты и шип

typecheck/lint/check:routes/test/audit:design/build; самокритика отдельным сабагентом;
коммиты по workstream'ам; версия в 2 местах + lockfile (worker получает новые deps);
docs/features/auto-genre.md обязателен.
