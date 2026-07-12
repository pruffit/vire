# §7.1 — Волна: материализация вкуса + вес источника. План реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Профиль вкуса читается point-lookup'ом из таблицы `taste_profiles` (пересчёт в editorial-кроне), а скоринг волны учитывает источник запуска: скип рекомендации волны весит сильнее скипа собственного выбора.

**Architecture:** Часть А — таблица `taste_profiles` + `materializeTasteProfiles()` первым шагом `generatePersonalPlaylistsForAllUsers()` (покрывает и крон `personal-4h`, и ручной прогон из админки одним код-путём); `getTasteProfile` = L1 TTL-кэш → таблица → живой расчёт с write-through. Часть Б — веса источников как константы в `packages/core`, в `wave.ts` взвешенный `qualityScore` и новый `waveSkipPenalty`; покрывающий индекс расширяется колонкой `source`.

**Tech Stack:** Drizzle (pg), BullMQ (существующий scheduler), Vitest (PgDialect-рендер SQL — образец `packages/db/src/queries/wave-order.test.ts`).

**Spec:** `docs/superpowers/specs/2026-07-12-wave-taste-materialization-design.md`

## Global Constraints

- Комментарии — только неочевидное «почему», 1–2 строки.
- Не интерполировать JS-`Date` в raw-`sql`; даты считать в SQL (`now() - interval '...'`).
- Числовые веса в SQL — через `sql.raw(...)`, НЕ bind-параметры (CASE…THEN $n Postgres выводит как integer — см. коммент `wave.ts:44`).
- Не интерполировать колонку в `sql` внутри `.select()` подзапроса — внешняя таблица литералом (`tracks.id`).
- Гейты: `pnpm --filter @vire/db typecheck && pnpm --filter @vire/core typecheck && pnpm --filter @vire/web typecheck && pnpm --filter @vire/web lint && pnpm --filter @vire/web test` + тесты db/core пакетов.

---

### Task 1: схема `taste_profiles` + миграция

**Files:**
- Modify: `packages/db/src/schema/interactions.ts` (или новый `packages/db/src/schema/taste.ts` + реэкспорт в `packages/db/src/schema/index.ts` — смотри как организован index)
- Create: `packages/db/src/migrations/0034_*.sql` (генерируется)

**Interfaces:**
- Produces: таблица `tasteProfiles` — `userId uuid PK (FK users cascade)`, `topMoods text[] not null default '{}'`, `topGenres text[] not null default '{}'`, `topArtistIds uuid[] not null default '{}'`, `computedAt timestamp not null defaultNow()`.

- [ ] **Step 1: Объявить таблицу**

```ts
export const tasteProfiles = pgTable('taste_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  topMoods: text('top_moods').array().notNull().default(sql`'{}'::text[]`),
  topGenres: text('top_genres').array().notNull().default(sql`'{}'::text[]`),
  topArtistIds: uuid('top_artist_ids').array().notNull().default(sql`'{}'::uuid[]`),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
});
```

Массивы — `text[]`, не enum[]: enum-массивы в Drizzle-миграциях капризны, а типобезопасность
восстанавливается фильтрацией по `ALL_MOODS`/`ALL_TRACK_GENRES` на чтении (Task 2).

- [ ] **Step 2: Сгенерировать миграцию**

Run: `pnpm --filter @vire/db db:generate`
Expected: новый файл `0034_*.sql` с `CREATE TABLE "taste_profiles"`. Проверить глазами, что там ТОЛЬКО эта таблица.

- [ ] **Step 3: Применить локально**

Run: `pnpm --filter @vire/db db:migrate`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema packages/db/src/migrations
git commit -m "feat(db): таблица taste_profiles под материализацию профиля вкуса"
```

---

### Task 2: чтение/запись/материализация в `taste.ts`

**Files:**
- Modify: `packages/db/src/queries/taste.ts`
- Modify: `packages/db/src/index.ts` (экспортировать `materializeTasteProfiles`)

**Interfaces:**
- Consumes: `tasteProfiles` из схемы (Task 1), `ALL_MOODS` (`./track-moods`), `ALL_TRACK_GENRES` (`./track-genres`).
- Produces: `materializeTasteProfiles(userIds: string[]): Promise<void>`; поведение `getTasteProfile(userId)` — кэш → таблица → живой расчёт + write-through (сигнатура НЕ меняется).

- [ ] **Step 1: Реализация**

```ts
import { tasteProfiles } from '../schema';
import { ALL_MOODS } from './track-moods';
import { ALL_TRACK_GENRES } from './track-genres';

const MOOD_SET = new Set<string>(ALL_MOODS);
const GENRE_SET = new Set<string>(ALL_TRACK_GENRES);

function toStoredProfile(row: { topMoods: string[]; topGenres: string[]; topArtistIds: string[] }): TasteProfile {
  return {
    topMoods: row.topMoods.filter((m): m is Mood => MOOD_SET.has(m)),
    topGenres: row.topGenres.filter((g): g is TrackGenre => GENRE_SET.has(g)),
    topArtistIds: row.topArtistIds,
  };
}

async function readStoredTasteProfile(userId: string): Promise<TasteProfile | null> {
  const [row] = await db
    .select({
      topMoods: tasteProfiles.topMoods,
      topGenres: tasteProfiles.topGenres,
      topArtistIds: tasteProfiles.topArtistIds,
    })
    .from(tasteProfiles)
    .where(eq(tasteProfiles.userId, userId))
    .limit(1);
  return row ? toStoredProfile(row) : null;
}

async function upsertTasteProfile(userId: string, profile: TasteProfile): Promise<void> {
  await db
    .insert(tasteProfiles)
    .values({
      userId,
      topMoods: profile.topMoods,
      topGenres: profile.topGenres,
      topArtistIds: profile.topArtistIds,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tasteProfiles.userId,
      set: {
        topMoods: profile.topMoods,
        topGenres: profile.topGenres,
        topArtistIds: profile.topArtistIds,
        computedAt: new Date(),
      },
    });
}

export async function materializeTasteProfiles(userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    try {
      const fresh = await fetchTasteProfile(userId);
      await upsertTasteProfile(userId, fresh);
    } catch (e) {
      console.error(`taste materialize failed for ${userId}`, e);
    }
  }
}
```

`new Date()` в `.values()`/`.set()` типизированной timestamp-колонки — допустимо (Drizzle знает тип); запрет касается raw-`sql`.

- [ ] **Step 2: Переключить `getTasteProfile` на таблицу**

```ts
export function getTasteProfile(userId: string): Promise<TasteProfile> {
  return tasteProfileCache.get(userId, async () => {
    const stored = await readStoredTasteProfile(userId);
    if (stored) return stored;
    const fresh = await fetchTasteProfile(userId);
    await upsertTasteProfile(userId, fresh);
    return fresh;
  });
}
```

- [ ] **Step 3: typecheck + существующие тесты**

Run: `pnpm --filter @vire/db typecheck && pnpm --filter @vire/db test`
Expected: зелёное (wave-order/editorial-policy/track-audio не задеты).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries/taste.ts packages/db/src/index.ts
git commit -m "feat(db): getTasteProfile читает материализованный профиль, materializeTasteProfiles"
```

---

### Task 3: материализация в editorial-проходе

**Files:**
- Modify: `packages/db/src/queries/editorial.ts` (`generatePersonalPlaylistsForAllUsers`, строки 237–256)

**Interfaces:**
- Consumes: `materializeTasteProfiles` (Task 2), `clearTasteProfileCache` (уже в `taste.ts`).

- [ ] **Step 1: Вызвать материализацию первым шагом**

В `generatePersonalPlaylistsForAllUsers()` уже собирается `userIds` (лайки ∪ прослушивания 90д). Сразу после сборки `userIds`, ДО цикла генерации:

```ts
await materializeTasteProfiles(userIds);
clearTasteProfileCache();
```

`clearTasteProfileCache` — чтобы генерация подборок в этом же процессе не подхватила запись L1-кэша, посчитанную до материализации. Ручной прогон из админки (`generateAllEditorialPlaylists`) проходит через эту же функцию — отдельной правки не нужно.

- [ ] **Step 2: typecheck + тесты db**

Run: `pnpm --filter @vire/db typecheck && pnpm --filter @vire/db test`
Expected: зелёное.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/queries/editorial.ts
git commit -m "feat(db): материализация профилей вкуса перед генерацией личных подборок"
```

---

### Task 4: константы весов источника в `packages/core` + тест

**Files:**
- Create: `packages/core/src/services/wave-scoring.ts`
- Test: `packages/core/src/__tests__/services/wave-scoring.test.ts`
- Modify: `packages/core/src/index.ts` (экспорт)

**Interfaces:**
- Produces: `sourceQualityWeight(source: string): number`; константы `PLAY_SOURCE_QUALITY_WEIGHTS: Readonly<Record<string, number>>`, `DEFAULT_SOURCE_QUALITY_WEIGHT = 0.8`, `WAVE_SKIP_PENALTY = 0.4`, `WAVE_SKIP_COMPLETION_THRESHOLD = 0.3`, `WAVE_SKIP_WINDOW_DAYS = 30`.

- [ ] **Step 1: Падающий тест**

```ts
import { describe, expect, it } from 'vitest';
import {
  sourceQualityWeight,
  PLAY_SOURCE_QUALITY_WEIGHTS,
  DEFAULT_SOURCE_QUALITY_WEIGHT,
  WAVE_SKIP_PENALTY,
  WAVE_SKIP_COMPLETION_THRESHOLD,
  WAVE_SKIP_WINDOW_DAYS,
} from '../../services/wave-scoring';

describe('sourceQualityWeight', () => {
  it('скип рекомендации волны — сильнейший сигнал', () => {
    expect(sourceQualityWeight('wave')).toBe(1.0);
  });
  it.each(['playlist', 'liked', 'purchased'])('осознанный выбор (%s) — слабый сигнал 0.6', (s) => {
    expect(sourceQualityWeight(s)).toBe(0.6);
  });
  it.each(['release', 'artist', 'home', 'feed', 'search', 'direct', 'unknown-future'])(
    'остальные и неизвестные (%s) — дефолт 0.8',
    (s) => {
      expect(sourceQualityWeight(s)).toBe(DEFAULT_SOURCE_QUALITY_WEIGHT);
    },
  );
  it('веса в диапазоне (0, 1]', () => {
    for (const w of Object.values(PLAY_SOURCE_QUALITY_WEIGHTS)) {
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});

describe('константы waveSkipPenalty', () => {
  it('значения зафиксированы', () => {
    expect(WAVE_SKIP_PENALTY).toBe(0.4);
    expect(WAVE_SKIP_COMPLETION_THRESHOLD).toBe(0.3);
    expect(WAVE_SKIP_WINDOW_DAYS).toBe(30);
  });
});
```

- [ ] **Step 2: Убедиться, что падает**

Run: `pnpm --filter @vire/core test -- wave-scoring`
Expected: FAIL (module not found).

- [ ] **Step 3: Реализация**

```ts
// скип трека, предложенного волной, — сильный сигнал о плохой рекомендации;
// скип собственного выбора слушателя говорит о треке меньше
export const PLAY_SOURCE_QUALITY_WEIGHTS: Readonly<Record<string, number>> = {
  wave: 1.0,
  playlist: 0.6,
  liked: 0.6,
  purchased: 0.6,
};

export const DEFAULT_SOURCE_QUALITY_WEIGHT = 0.8;

export function sourceQualityWeight(source: string): number {
  return PLAY_SOURCE_QUALITY_WEIGHTS[source] ?? DEFAULT_SOURCE_QUALITY_WEIGHT;
}

export const WAVE_SKIP_PENALTY = 0.4;
export const WAVE_SKIP_COMPLETION_THRESHOLD = 0.3;
export const WAVE_SKIP_WINDOW_DAYS = 30;
```

Экспортировать всё из `packages/core/src/index.ts` по образцу соседних экспортов.

- [ ] **Step 4: Тест зелёный**

Run: `pnpm --filter @vire/core test -- wave-scoring`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/services/wave-scoring.ts packages/core/src/__tests__/services/wave-scoring.test.ts packages/core/src/index.ts
git commit -m "feat(core): веса источника запуска для скоринга волны"
```

---

### Task 5: взвешенный qualityScore + waveSkipPenalty в `wave.ts` + рендер-тест

**Files:**
- Modify: `packages/db/src/queries/wave.ts` (`qualityScore` строки 129–134; `totalScore` строки 354–357; seed-режим с taste строка 217)
- Test: `packages/db/src/queries/wave-scoring-sql.test.ts` (по образцу `wave-order.test.ts` — PgDialect, мок `../client`)

**Interfaces:**
- Consumes: `sourceQualityWeight`-константы из `@vire/core` (Task 4).
- Produces: `qualityScore` — взвешенное среднее по источникам; `waveSkipPenaltyFor(userId: string | null): SQL<number>`.

- [ ] **Step 1: Собрать CASE весов из констант core**

В `wave.ts` (импорт из `@vire/core`):

```ts
import {
  PLAY_SOURCE_QUALITY_WEIGHTS,
  DEFAULT_SOURCE_QUALITY_WEIGHT,
  WAVE_SKIP_PENALTY,
  WAVE_SKIP_COMPLETION_THRESHOLD,
  WAVE_SKIP_WINDOW_DAYS,
} from '@vire/core';

// веса — sql.raw: bind-параметры внутри CASE Postgres выводит как integer (см. genreOverlapTerm)
const sourceWeightCase = sql.raw(
  `CASE pe.source ${Object.entries(PLAY_SOURCE_QUALITY_WEIGHTS)
    .map(([s, w]) => `WHEN '${s}' THEN ${w}`)
    .join(' ')} ELSE ${DEFAULT_SOURCE_QUALITY_WEIGHT} END`,
);
```

Ключи `PLAY_SOURCE_QUALITY_WEIGHTS` — литералы из core, не пользовательский ввод; инъекции нет.

- [ ] **Step 2: Заменить `qualityScore` на взвешенное среднее**

```ts
// Качество: взвешенная по источнику доля дослушивания за 90 дней — скип рекомендации
// волны тянет вниз сильнее, чем скип собственного выбора. Вес терма до 0.3.
const qualityScore = sql<number>`COALESCE((
    SELECT SUM(${sourceWeightCase} * LEAST(1.0, pe.duration_played_sec::float / NULLIF(tracks.duration_sec, 0)))
         / NULLIF(SUM(${sourceWeightCase}), 0)
    FROM play_events pe
    WHERE pe.track_id = tracks.id
      AND pe.started_at >= now() - interval '90 days'
  ), 0) * 0.3`;
```

- [ ] **Step 3: Добавить `waveSkipPenaltyFor`**

Рядом с `qualityScore`:

```ts
// «волна уже предлагала, слушатель проскипал» — не возвращать трек так скоро
export function waveSkipPenaltyFor(userId: string | null): SQL<number> {
  if (!userId) return sql<number>`0`;
  const penalty = sql.raw(`-${WAVE_SKIP_PENALTY}`);
  const threshold = sql.raw(WAVE_SKIP_COMPLETION_THRESHOLD.toString());
  const windowDays = sql.raw(`'${WAVE_SKIP_WINDOW_DAYS} days'`);
  return sql<number>`CASE WHEN EXISTS (
      SELECT 1 FROM play_events pw
      WHERE pw.track_id = tracks.id
        AND pw.user_id = ${userId}::uuid
        AND pw.source = 'wave'
        AND pw.started_at >= now() - interval ${windowDays}
        AND pw.duration_played_sec::float / NULLIF(tracks.duration_sec, 0) < ${threshold}
    ) THEN ${penalty} ELSE 0 END`;
}
```

- [ ] **Step 4: Вшить в оба режима со скорингом**

Режим похожести — в `totalScore` (строки 354–357) добавить терм:

```ts
const waveSkipPenalty = waveSkipPenaltyFor(p.userId);
const totalScore = sql<number>`${moodScore} + ${bpmScore} + ${keyScore} + ${genreScore}
  + ${tasteMoodScore} + ${tasteGenreScore} + ${qualityScore} + ${momentScore}
  + ${fatiguePenalty} + ${diversityPenalty} + ${waveSkipPenalty}
  + random() * 0.15`;
```

Seed-режим вошедшего (строка 217): `+ ${waveSkipPenaltyFor(p.userId)}` в totalScore рядом с `${qualityScore}`. Анонимную ветку не трогать.

- [ ] **Step 5: Рендер-тест SQL**

`packages/db/src/queries/wave-scoring-sql.test.ts` — скопировать механику мока/рендера из `wave-order.test.ts` (мок `../client`, `PgDialect().sqlToQuery(...)`):

```ts
import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../client', () => ({ db: {} }));

const { waveSkipPenaltyFor } = await import('./wave');

describe('waveSkipPenaltyFor', () => {
  const dialect = new PgDialect();

  it('для анонима — константа 0', () => {
    const q = dialect.sqlToQuery(waveSkipPenaltyFor(null));
    expect(q.sql.trim()).toBe('0');
  });

  it('для юзера — exists по source=wave с порогом и окном из core', () => {
    const q = dialect.sqlToQuery(waveSkipPenaltyFor('00000000-0000-0000-0000-000000000001'));
    expect(q.sql).toContain(`pw.source = 'wave'`);
    expect(q.sql).toContain(`interval '30 days'`);
    expect(q.sql).toContain('< 0.3');
    expect(q.sql).toContain('-0.4');
  });
});
```

Если `wave.ts` при импорте тянет ещё модули с побочными эффектами — замокать их так же, как это делает `wave-order.test.ts`.

- [ ] **Step 6: Прогнать тесты**

Run: `pnpm --filter @vire/db test && pnpm --filter @vire/web test`
Expected: зелёное; `wave/route.test.ts` без правок (сигнатуры `getWaveTracks`/`getTasteProfile` не менялись).

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/queries/wave.ts packages/db/src/queries/wave-scoring-sql.test.ts
git commit -m "feat(db): скоринг волны учитывает источник запуска — взвешенное качество + штраф wave-скипа"
```

---

### Task 6: расширить покрывающий индекс колонкой source

**Files:**
- Create: `packages/db/src/migrations/0035_play_events_covering_source.sql` (кастомная, по образцу `0033_play_events_covering_index.sql`; создать через `pnpm --filter @vire/db db:generate -- --custom` либо тем способом, каким создавалась 0033 — проверить journal `_journal.json`)

**Interfaces:**
- Consumes: взвешенный `qualityScore` (Task 5) читает `pe.source` — без INCLUDE ломается Index Only Scan из 0033.

- [ ] **Step 1: Написать миграцию**

```sql
-- qualityScore стал взвешенным по source (wave-scoring) — колонка нужна в INCLUDE,
-- иначе Index Only Scan из 0033 деградирует в heap fetches. Без CONCURRENTLY: см. 0033.
DROP INDEX "play_events_track_started_covering_idx";
CREATE INDEX "play_events_track_started_covering_idx" ON "play_events" USING btree ("track_id","started_at") INCLUDE ("duration_played_sec","source");
```

Убедиться, что файл зарегистрирован в `packages/db/src/migrations/meta/_journal.json` (как это сделано для 0033) — иначе `db:migrate` его не увидит.

- [ ] **Step 2: Применить локально**

Run: `pnpm --filter @vire/db db:migrate`
Expected: exit 0; `\di play_events*` в psql (или Drizzle Studio) показывает новый состав INCLUDE.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/migrations
git commit -m "perf(db): source в покрывающем индексе play_events под взвешенный qualityScore"
```

---

### Task 7: документация и роадмап

**Files:**
- Modify: `docs/features/wave.md` — секция скоринга: взвешенный qualityScore (веса источников из `@vire/core` wave-scoring), waveSkipPenalty (−0.4, <30% дослушивания, 30 дней, только source=wave); секция профиля вкуса: таблица `taste_profiles`, пересчёт в editorial-кроне `personal-4h`, fallback на живой расчёт.
- Modify: `docs/features/curated-playlists.md` — профиль вкуса теперь материализован (та же таблица), L1-кэш 60с остался.
- Modify: `docs/roadmap/stage-2.md` — §7.1 → ✅ (и сводка вверху).
- Modify: `docs/roadmap/roadmap-1.0.md` — строку 26 «Будущее: материализация…» → `[x]` с кратким итогом.
- Modify: `CLAUDE.md` — из «Что делать дальше» убрать §7.1.

- [ ] **Step 1: Обновить все пять файлов.**

- [ ] **Step 2: Commit**

```bash
git add docs/features/wave.md docs/features/curated-playlists.md docs/roadmap/stage-2.md docs/roadmap/roadmap-1.0.md CLAUDE.md
git commit -m "docs: §7.1 закрыт — материализация вкуса и вес источника в волне"
```
