import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, pgEnum, primaryKey, index } from 'drizzle-orm/pg-core';
import { artistProfiles } from './artists';

export const releaseTypeEnum = pgEnum('release_type', ['ALBUM', 'EP', 'SINGLE']);
// Жанры — фиксированный список, заполняет артист (зеркало ALL_GENRES в @vire/core).
// ПОРЯДОК append-only: исходные 14 первыми (в историческом порядке), новые дописаны
// в конец — так миграция остаётся чистым ALTER TYPE ADD VALUE, без пересоздания enum.
// Группировку для UI см. apps/web/lib/genres.ts (от порядка enum не зависит).
export const genreEnum = pgEnum('genre', [
  // Исходные 14 — не трогать порядок
  'ELECTRONIC', 'HIPHOP', 'ROCK', 'INDIE', 'POP', 'AMBIENT', 'JAZZ',
  'CLASSICAL', 'METAL', 'FOLK', 'RNB', 'TECHNO', 'EXPERIMENTAL', 'LOFI',
  // Добавлены позже (append-only)
  'HOUSE', 'TRANCE', 'DNB', 'DUBSTEP', 'GARAGE', 'BREAKBEAT', 'IDM', 'SYNTHWAVE',
  'DOWNTEMPO', 'HARDSTYLE', 'BOOMBAP', 'TRAP', 'DRILL', 'CLOUDRAP', 'PHONK',
  'NEOSOUL', 'SOUL', 'FUNK', 'ALTERNATIVE', 'PUNK', 'POSTPUNK', 'PSYCHEDELIC',
  'SHOEGAZE', 'GRUNGE', 'PROGROCK', 'HEAVYMETAL', 'DEATHMETAL', 'BLACKMETAL',
  'DOOM', 'METALCORE', 'POSTMETAL', 'INDIEPOP', 'SYNTHPOP', 'HYPERPOP', 'DREAMPOP',
  'BLUES', 'BEBOP', 'FUSION', 'SWING', 'ORCHESTRAL', 'CINEMATIC', 'NEOCLASSICAL',
  'OPERA', 'PIANO', 'ACOUSTIC', 'SINGER_SONGWRITER', 'COUNTRY', 'WORLD', 'NOISE',
  'DRONE', 'INDUSTRIAL', 'REGGAE', 'DUB', 'SOUNDTRACK', 'SPOKENWORD',
  // Расширение до покрытия Discogs-400 (append-only) — электроника: хаус
  'ACID', 'ACID_HOUSE', 'BEATDOWN', 'DEEP_HOUSE', 'ELECTRO_HOUSE', 'EURO_HOUSE',
  'GARAGE_HOUSE', 'GHETTO', 'GHETTO_HOUSE', 'HARD_HOUSE', 'HIP_HOUSE', 'ITALO_HOUSE',
  'PROGRESSIVE_HOUSE', 'TECH_HOUSE', 'TRIBAL_HOUSE', 'TROPICAL_HOUSE',
  // техно
  'BLEEP', 'DEEP_TECHNO', 'DUB_TECHNO', 'HARD_TECHNO', 'MINIMAL', 'MINIMAL_TECHNO', 'SCHRANZ',
  // транс
  'GOA_TRANCE', 'HARD_TRANCE', 'PROGRESSIVE_TRANCE', 'PSY_TRANCE', 'TECH_TRANCE',
  // хардкор и хардстайл
  'HARDCORE_EDM', 'GABBER', 'HAPPY_HARDCORE', 'SPEEDCORE', 'DONK', 'HANDS_UP', 'JUMPSTYLE', 'MAKINA',
  // бас, брейкбит и гараж
  'BASSLINE', 'SPEED_GARAGE', 'GRIME', 'JUNGLE', 'HALFTIME', 'BREAKCORE', 'BROKEN_BEAT',
  'BIG_BEAT', 'PROGRESSIVE_BREAKS', 'JUKE', 'ELECTRO',
  // эмбиент и даунтемпо
  'DARK_AMBIENT', 'NEW_AGE', 'BERLIN_SCHOOL', 'ILLBIENT', 'CHILLWAVE', 'TRIP_HOP',
  'DUNGEON_SYNTH', 'GLITCH', 'LEFTFIELD', 'FUTURE_JAZZ', 'ACID_JAZZ', 'JAZZDANCE',
  // синт, диско и ретро
  'DISCO', 'EURO_DISCO', 'ITALO_DISCO', 'NU_DISCO', 'HI_NRG', 'EUROBEAT', 'EURODANCE',
  'ITALODANCE', 'DISCO_POLO', 'DANCE_POP', 'FREESTYLE', 'ELECTROCLASH', 'DARKWAVE',
  'NEW_WAVE', 'NEW_BEAT', 'EBM', 'VAPORWAVE', 'CHIPTUNE',
  // электроника: прочее
  'MUSIQUE_CONCRETE', 'POWER_ELECTRONICS', 'RHYTHMIC_NOISE', 'SOUND_COLLAGE', 'TRIBAL',
  // хип-хоп
  'BASS_MUSIC', 'BOUNCE', 'BRITCORE', 'CONSCIOUS', 'CRUNK', 'CUT_UP_DJ', 'G_FUNK',
  'GANGSTA', 'HARDCORE_HIPHOP', 'HORRORCORE', 'INSTRUMENTAL_HIPHOP', 'JAZZY_HIPHOP',
  'MIAMI_BASS', 'POP_RAP', 'RAGGA_HIPHOP', 'SCREW', 'TURNTABLISM',
  // соул и фанк
  'AFROBEAT', 'BOOGIE', 'FREE_FUNK', 'P_FUNK', 'PSYCHEDELIC_SOUL', 'NEW_JACK_SWING',
  'UK_STREET_SOUL', 'GOSPEL',
  // рок
  'ACID_ROCK', 'AOR', 'ARENA_ROCK', 'ART_ROCK', 'BEAT', 'BLUES_ROCK', 'BRITPOP',
  'CLASSIC_ROCK', 'COLDWAVE', 'COUNTRY_ROCK', 'DEATHROCK', 'DOO_WOP', 'EMO', 'ETHEREAL',
  'FOLK_ROCK', 'GARAGE_ROCK', 'GLAM', 'GOTH_ROCK', 'HARD_ROCK', 'KRAUTROCK', 'LOUNGE',
  'MATH_ROCK', 'MOD', 'NO_WAVE', 'POP_ROCK', 'POST_ROCK', 'POWER_POP', 'PSYCHOBILLY',
  'PUB_ROCK', 'ROCK_N_ROLL', 'ROCKABILLY', 'SOFT_ROCK', 'SOUTHERN_ROCK', 'SPACE_ROCK',
  'STONER_ROCK', 'SURF', 'SYMPHONIC_ROCK', 'TWIST', 'YEYE',
  // панк и хардкор
  'HARDCORE_PUNK', 'MELODIC_HARDCORE', 'POST_HARDCORE', 'POP_PUNK', 'OI', 'CRUST',
  'POWER_VIOLENCE', 'NOISECORE',
  // метал
  'ATMOSPHERIC_BLACK_METAL', 'DEPRESSIVE_BLACK_METAL', 'VIKING_METAL', 'MELODIC_DEATH_METAL',
  'TECHNICAL_DEATH_METAL', 'DEATHCORE', 'GRINDCORE', 'FUNERAL_DOOM', 'SLUDGE_METAL',
  'NU_METAL', 'FOLK_METAL', 'FUNK_METAL', 'GOTHIC_METAL', 'POWER_METAL',
  'PROGRESSIVE_METAL', 'SPEED_METAL', 'THRASH',
  // поп
  'BALLAD', 'BUBBLEGUM', 'CHANSON', 'CITY_POP', 'EUROPOP', 'J_POP', 'K_POP', 'KAYOKYOKU',
  'SCHLAGER', 'VOCAL', 'NOVELTY', 'LIGHT_MUSIC', 'MUSIC_HALL', 'BOLLYWOOD',
  // джаз
  'AFRO_CUBAN_JAZZ', 'AVANTGARDE_JAZZ', 'BIG_BAND', 'BOSSA_NOVA', 'CONTEMPORARY_JAZZ',
  'COOL_JAZZ', 'DIXIELAND', 'EASY_LISTENING', 'FREE_IMPROVISATION', 'FREE_JAZZ',
  'GYPSY_JAZZ', 'HARD_BOP', 'JAZZ_FUNK', 'JAZZ_ROCK', 'LATIN_JAZZ', 'MODAL_JAZZ',
  'POST_BOP', 'RAGTIME', 'SMOOTH_JAZZ', 'SOUL_JAZZ', 'SPACE_AGE',
  // блюз
  'BOOGIE_WOOGIE', 'CHICAGO_BLUES', 'COUNTRY_BLUES', 'DELTA_BLUES', 'ELECTRIC_BLUES',
  'HARMONICA_BLUES', 'JUMP_BLUES', 'LOUISIANA_BLUES', 'MODERN_ELECTRIC_BLUES',
  'PIANO_BLUES', 'TEXAS_BLUES',
  // классика
  'BAROQUE', 'CHORAL', 'CONTEMPORARY_CLASSICAL', 'IMPRESSIONIST', 'MEDIEVAL',
  'MODERN_CLASSICAL', 'NEO_ROMANTIC', 'POST_MODERN_CLASSICAL', 'RENAISSANCE', 'ROMANTICISM',
  // фолк и кантри
  'BLUEGRASS', 'CAJUN', 'CELTIC', 'HILLBILLY', 'HONKY_TONK', 'POLKA', 'VOLKSMUSIK', 'NEOFOLK',
  // этника
  'AFRICAN', 'CANZONE_NAPOLETANA', 'CATALAN_MUSIC', 'FADO', 'FLAMENCO', 'HIGHLIFE',
  'HINDUSTANI', 'INDIAN_CLASSICAL', 'LAIKO', 'NORDIC', 'PACIFIC', 'RAI', 'ROMANI',
  'SOUKOUS', 'SEGA', 'ZOUK', 'ENTEKHNO',
  // латино
  'LATIN', 'AFRO_CUBAN', 'BAIAO', 'BATUCADA', 'BEGUINE', 'BOLERO', 'BOOGALOO', 'CHA_CHA',
  'CHARANGA', 'COMPAS', 'CUBANO', 'CUMBIA', 'DESCARGA', 'FORRO', 'GUAGUANCO', 'GUAJIRA',
  'GUARACHA', 'MPB', 'MAMBO', 'MARIACHI', 'MERENGUE', 'NORTENO', 'NUEVA_CANCION',
  'PACHANGA', 'PORRO', 'RANCHERA', 'REGGAETON', 'RUMBA', 'SALSA', 'SAMBA', 'SON',
  'SON_MONTUNO', 'TANGO', 'TEJANO', 'VALLENATO',
  // регги
  'CALYPSO', 'DANCEHALL', 'LOVERS_ROCK', 'RAGGA', 'REGGAE_POP', 'ROCKSTEADY',
  'ROOTS_REGGAE', 'SKA', 'SOCA',
  // сцена и прочее
  'MUSICAL', 'BRASS', 'FIELD_RECORDING',
]);
export const releaseStatusEnum = pgEnum('release_status', ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']);
// FAILED — транскодинг исчерпал все попытки; трек не воспроизводится, артист
// уведомлён письмом, в админке помечен в «требует внимания».
export const trackStatusEnum = pgEnum('track_status', ['PROCESSING', 'READY', 'BLOCKED', 'FAILED']);

export const releases = pgTable('releases', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistProfileId: uuid('artist_profile_id').notNull().references(() => artistProfiles.id),
  title: text('title').notNull(),
  type: releaseTypeEnum('type').notNull().default('ALBUM'),
  genre: genreEnum('genre'),
  coverUrl: text('cover_url'),
  releaseDate: timestamp('release_date'),
  // Момент реального выхода в эфир (DRAFT/SCHEDULED → PUBLISHED). В отличие от
  // release_date (задаёт артист) и created_at (создание черновика) — это честная
  // отметка «когда релиз стал публичным». Источник правды для сортировки «свежее».
  publishedAt: timestamp('published_at'),
  status: releaseStatusEnum('status').notNull().default('DRAFT'),
  description: text('description'),
  linerNotes: text('liner_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('releases_artist_profile_id_idx').on(t.artistProfileId)]);

export const tracks = pgTable('tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  releaseId: uuid('release_id').notNull().references(() => releases.id),
  title: text('title').notNull(),
  trackNumber: integer('track_number').notNull(),
  // Версия/ремикс: «Radio Edit», «Slowed + Reverb», «Sped Up» и т.п. Отдельно от
  // названия (его не засоряем) — показывается бейджем/суффиксом рядом с треком.
  version: text('version'),
  durationSec: integer('duration_sec'),
  status: trackStatusEnum('status').notNull().default('PROCESSING'),
  // Файл в хранилище всегда по track_id, не по артисту
  // /vault/tracks/{id}/source.flac — политика ухода артиста работает автоматически
  isExclusive: boolean('is_exclusive').notNull().default(false),
  isWip: boolean('is_wip').notNull().default(false),
  // Возрастная маркировка 18+ (explicit): мат/откровенный контент. 436-ФЗ.
  isExplicit: boolean('is_explicit').notNull().default(false),
  // Отображаемые кредиты — для витрины. Финансовые доли — в track_contributors (этап 4)
  credits: jsonb('credits').default([]),
  // Синхронизированный текст: массив строк { t: секунды|null, text }. null/[] — нет текста.
  lyrics: jsonb('lyrics'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [index('tracks_release_id_idx').on(t.releaseId)]);

export const moodEnum = pgEnum('mood', [
  'MELANCHOLY',
  'NIGHT',
  'DRIVE',
  'AMBIENT',
  'HYPE',
  'CHILL',
  'EPIC',
  'DARK',
  'ROMANTIC',
  'NOSTALGIC',
  // Добавлены позже — порядок append-only (enum)
  'DREAMY',
  'AGGRESSIVE',
  'UPLIFTING',
  'SAD',
  'GROOVY',
  'MEDITATIVE',
  'TENSE',
  'PLAYFUL',
]);

// Жанры трека — до 3, из фиксированного списка (тот же enum что у релиза)
export const trackGenres = pgTable('track_genres', {
  trackId: uuid('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  genre: genreEnum('genre').notNull(),
}, (t) => [primaryKey({ columns: [t.trackId, t.genre] })]);

// Теги настроения — фиксированный список, не свободный ввод (нет UGC/модерации)
// Сырьё для волны ступени 1
export const trackMoods = pgTable('track_moods', {
  trackId: uuid('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  mood: moodEnum('mood').notNull(),
}, (t) => [primaryKey({ columns: [t.trackId, t.mood] })]);

// Медиа-часть трека — заполняется воркером асинхронно
export const trackAudio = pgTable('track_audio', {
  trackId: uuid('track_id').primaryKey().references(() => tracks.id),
  hlsManifestKey: text('hls_manifest_key'),
  // Предрассчитанные пики для waveform — без Web Audio API
  waveformPeaks: jsonb('waveform_peaks'),
  flacKey: text('flac_key'),
  // Аудио-метаданные для волны (ступень 1 — по тегам)
  bpm: integer('bpm'),
  musicalKey: text('musical_key'),
  // Автоопределение жанра (Essentia discogs-effnet) — топ-5 [{ genre, confidence }],
  // всегда сохраняется независимо от автоприменения в track_genres. См. docs/features/auto-genre.md.
  genreSuggestions: jsonb('genre_suggestions'),
  // Раздельные метки готовности анализа по требованию (не общий updatedAt) — иначе
  // поллинг BPM/key и поллинг жанра не различают, чья джоба завершилась, если обе
  // кнопки нажаты подряд. См. docs/features/audio-analysis.md.
  bpmKeyAnalyzedAt: timestamp('bpm_key_analyzed_at'),
  genreAnalyzedAt: timestamp('genre_analyzed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
