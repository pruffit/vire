# План: перенос чистой логики в core (волна 5)

**Спека:** `docs/superpowers/specs/2026-08-12-pure-logic-wave5.md`.
Три среза, последовательно. После каждого — гейты и коммит.

## Общие правила

- Перенос без изменения поведения. Тело функции при переезде не переписывается;
  меняются только сигнатуры там, где это указано явно (обобщение в срезе A).
- Старый путь остаётся файлом-реэкспортом (`export * from '@vire/core'` или точечно) —
  потребители не правятся. Это же и механизм отката.
- Тесты переезжают вместе с кодом в `packages/core`, в web-копии не остаются.
- Всё новое в core — через barrel `packages/core/src/index.ts` (подпути не заводим,
  ничего из этого не нужно edge-middleware).
- Комментарии — только неочевидное «почему», 1–2 строки.

## Срез A — очередь и форматтеры

**A.1 `queue.ts` → `packages/core/src/music/playback/services/queue.ts`**

Перенести восемь функций и тип `Repeat`. Обобщить по `T extends { id: string }`
все функции, которые сейчас прибиты к `PlayerTrack[]`: `capLiveQueue`, `shuffleOn`,
`shuffleOff`, `insertIntoQueue`, `dedupeQueue`. `LIVE_QUEUE_WINDOW_BEFORE` экспортировать
(сейчас приватная) — иначе константа окажется в core без доступа к ней из тестов web.
`apps/web/lib/player/queue.ts` → реэкспорт. `queue.test.ts` → в core рядом с кодом.

Проверка обобщения: `store/player.ts` и `audio-engine.ts` не правятся вообще — если
для них потребовалась правка, значит сигнатура разошлась.

**A.2 `format.ts` → `packages/core/src/platform/util/format.ts`**

Перенести как есть, включая `ListenTimeUnit`. `apps/web/lib/format.ts` → реэкспорт.
`apps/web/lib/__tests__/format.test.ts` → в core.

## Срез B — примитивы насыщения

**B.1** `packages/core/src/platform/util/scoring.ts`:
- `saturateLinear(n: number, k: number): number` — `Math.min(1, Math.max(0, n) / k)`;
- `saturateLog(n: number, k: number): number` — `n <= 0 ? 0 : Math.log1p(n) / Math.log1p(n + k)`.
Тест на обе: монотонность, границы (0 → 0, ∞ → потолок/1), точка насыщения.

**B.2** `music/discovery/services/discovery-scoring.ts` — `friendSignal` через
`saturateLinear(friendListeners, FRIEND_SIGNAL_SATURATION)`. Константа остаётся здесь.

**B.3** `music/discovery/services/feed-ranking.ts` — `popularityScore` через
`saturateLog(plays30d, k)`. Сигнатура с дефолтом `k` сохраняется.

**B.4** `music/playback/services/wave-scoring.ts` — экспортировать
`WAVE_MOMENT_SATURATION = 5` и `WAVE_MOMENT_WEIGHT = 0.2`;
`packages/db/src/queries/wave.ts` подставляет их в `sql`-шаблон `momentScore` вместо
литералов. Проверить `packages/db/src/queries/wave-scoring-sql.test.ts` — если он
ассертит текст SQL, ассерт обновить на ту же строку, собранную из констант.

Существующие тесты discovery-scoring и feed-ranking править **нельзя** — они и есть
доказательство, что поведение не изменилось.

## Срез C — сессия волны и политика движка

**C.1** В `packages/core/src/music/playback/repositories/wave.ts` (рядом с портом
`IWaveSessionStore`) добавить: `WAVE_SESSION_TTL_SEC = 6 * 60 * 60`,
`WAVE_SESSION_MAX_SERVED = 300`, `waveServedKey(sessionId)`, `waveSeedKey(sessionId)`.
Значения и формат ключей взять из `apps/web/lib/wave-session.ts` **дословно** — смена
строки ключа обнулит живые сессии в Redis. `apps/web/lib/wave-session.ts` импортирует их
вместо своих локальных.

**C.2** `packages/core/src/music/playback/services/engine-policy.ts` — шесть чистых
предикатов/функций из спеки §5.5: `shouldGiveUpOnWave`, `shouldStopLocalRetries`,
`shouldPrefetchNext`, `shouldRunTick`, `clampRestoredQueueIndex`, `playedIdsWindow`.
Пороги (3, 3, 15 сек, 5000 мс, 100) — именованные экспортируемые константы, значения
строго те же, что сейчас в `audio-engine.ts`. Тест на каждую, включая граничные значения
(ровно на пороге — прежнее поведение `>=` / `>` сохранить буквально).

`clampRestoredQueueIndex` сейчас читает стор — в core уезжает чистая часть
(индекс + длина очереди на вход), чтение стора остаётся в движке.

**C.3** `apps/web/lib/player/audio-engine.ts` зовёт эти функции вместо инлайновых
условий. Мутабельные счётчики (`consecutiveWaveErrors`, `consecutiveLocalMisses`,
`lastTickAt`, `prefetchedAheadFor`) остаются в движке. Никакой другой рефакторинг
файла в этот срез не входит — ни переименования, ни перестановки блоков.

`audio-engine.test.ts` остаётся в web (он про I/O-драйвер), но не должен ослабнуть:
если тест ассертил поведение порога — он остаётся ассертом порога.

## Гейты после каждого среза

```bash
pnpm --filter @vire/core typecheck && pnpm --filter @vire/web typecheck
pnpm turbo run check:layers
pnpm --filter @vire/web lint
pnpm --filter @vire/web test
pnpm --filter @vire/core test
```

После среза C дополнительно: `check:routes`, `check:i18n`, `check:contracts`,
прод-сборка. Прожарка дифа отдельным агентом — после среза C (диф волны трогает плеер).

## Доки после волны

`docs/migration-plan.md` — волна 5 ✅ с фактическим содержанием срезов и явной записью,
что 5.5 сужен, а `IAudioEngine` отложен по условию (появление второго драйвера);
`docs/roadmap/platform-core-brief.md` — журнал фаз.
