# Расширение справочника жанров до Discogs-400

Дата: 2026-07-06. Запрос: авто-жанры «едва попадают» — 400 предсказаний модели
схлопываются в 65 жанров с потерями. Расширить список жанров площадки до полного
покрытия музыкальной части таксономии Discogs-400.

## Что строим

1. **`genreEnum` расширяется с 65 до ~370 значений** — каждая музыкальная метка
   Discogs-400 получает точный жанр-аналог. Существующие 65 значений остаются
   (append-only, миграция — чистый `ALTER TYPE ADD VALUE`).
2. **Маппинг модели становится ~1:1** (`discogs-genre-map.ts`): точечный сабжанр →
   свой жанр. Агрегация (max + 0.3×tail) не меняется — она всё ещё нужна жанрам,
   собирающим 2+ метки (CLASSICAL, BRASS, GRINDCORE…).
3. **Отбрасываются осознанно** (экспортируемый `DROPPED_LABELS`):
   Non-Music кроме Poetry/Spoken Word (→ SPOKENWORD) и Field Recording
   (→ новый FIELD_RECORDING); Children's ×3; Pop/Rock---Parody.
   Brass & Military ×3 → один новый жанр BRASS.
4. **Одноимённые стили под разными родителями**: один жанр, если это один жанр
   по сути (Grime, Trip Hop, Disco, Gospel, Afrobeat, Neofolk, New Wave, Electro,
   Industrial, Noise, Experimental, Dub, Ska, Rhythm & Blues); разные — если
   смысл разный (Electronic---Hardcore → HARDCORE_EDM-семантика vs
   Rock---Hardcore → хардкор-панк; Funk/Soul---Psychedelic → психоделик-соул vs
   Rock---Psychedelic Rock → PSYCHEDELIC).
5. **Семейства жанров для «Волны»** — новый модуль в `packages/db`
   (`GENRE_FAMILY: Record<TrackGenre, GenreFamily>`, ~25–30 семейств по музыкальной
   близости: house, techno, trance, hard-dance, bass, breakbeat, ambient, downtempo,
   synth-retro, disco-funk, hiphop, rnb-soul, rock, indie, punk, metal, pop, jazz,
   blues, classical, folk, country, world, latin, reggae, soundtrack, experimental,
   spoken…). Волна дополняется family-подматчингом:
   - seed-фильтр и session-boost: жанр слушателя расширяется до его семейства;
   - `genreScore`: к точному пересечению (вес 0.4) добавляется семейное (вес 0.2,
     только если точного нет);
   - taste-скоринг: аналогично, семейный терм с половинным весом.
6. **Порог автоприменения** `AUTO_APPLY_THRESHOLD` 0.1 → 0.05: confidence
   нормализуется по ~370 корзинам вместо 65, доля топа падает примерно вдвое.
7. **UI**: `GENRE_GROUPS` реструктурируются в ~20 групп (Электроника делится на
   Хаус / Техно / Транс / Бас и брейкбит / Хардкор и хардстайл / Эмбиент и
   даунтемпо / Синт и ретро…), лейблы: русские для общеизвестных, английские для
   сценовых имён (прецедент уже смешанный). Пикеры уже умеют группы + поиск.

## Чего НЕ делаем

- Не трогаем формат `genre_suggestions` (топ-5, `{genre, confidence}`).
- Не переделываем `GenreSelect`/`GenrePicker` — группы+поиск уже есть.
- Не меняем препроцессинг/инференс модели.

## Жанры, недостижимые для модели

PHONK, DRILL, HYPERPOP, ORCHESTRAL, PIANO, SINGER_SONGWRITER — в Discogs-400
по-прежнему нет аналогов; остаются только для ручного выбора.

## Инварианты (тестами)

- Каждая из 400 меток — либо в `DISCOGS_TO_GENRE`, либо в `DROPPED_LABELS`;
  пересечение пусто; сумма = 400.
- Зеркала совпадают: `genreEnum.enumValues` (db) == `ALL_GENRES` (core) ==
  жанры web (`GENRE_LABELS`/группы) — по составу и порядку (db/core).
- `GENRE_GROUPS` — разбиение: каждый жанр ровно в одной группе; `GENRE_LABELS`
  покрывает все жанры (типами + тестом).
- У каждого жанра есть семейство.
