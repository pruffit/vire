export type ReleaseType = 'ALBUM' | 'EP' | 'SINGLE';

// Жанры — фиксированный список (как mood-теги: без свободного ввода и модерации).
// Заполняет артист при создании/редактировании релиза. Должен совпадать с genreEnum
// в packages/db/src/schema/releases.ts. Группировку для UI см. apps/web/lib/genres.ts.
export const ALL_GENRES = [
  // Исходные 14 — порядок как в genreEnum (append-only)
  'ELECTRONIC', 'HIPHOP', 'ROCK', 'INDIE', 'POP', 'AMBIENT', 'JAZZ',
  'CLASSICAL', 'METAL', 'FOLK', 'RNB', 'TECHNO', 'EXPERIMENTAL', 'LOFI',
  // Добавлены позже
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
] as const;
export type Genre = (typeof ALL_GENRES)[number];

export const ALL_CONTRIBUTOR_ROLES = ['PERFORMER', 'FEATURED', 'LYRICIST', 'COMPOSER', 'PRODUCER'] as const;
export type ContributorRole = (typeof ALL_CONTRIBUTOR_ROLES)[number];

export interface TrackCredit {
  name: string;
  role: ContributorRole;
}

/** Строка текста трека. `t` — таймкод в секундах (null = строка без синхронизации). */
export interface LyricLine {
  t: number | null;
  text: string;
}
export type ReleaseStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
export type TrackStatus = 'PROCESSING' | 'READY' | 'BLOCKED' | 'FAILED';

export interface Release {
  id: string;
  artistProfileId: string;
  title: string;
  type: ReleaseType;
  genre: Genre | null;
  coverUrl: string | null;
  releaseDate: Date | null;
  status: ReleaseStatus;
  description: string | null;
  linerNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Track {
  id: string;
  releaseId: string;
  title: string;
  /** Версия/ремикс («Radio Edit», «Slowed + Reverb»). null — обычная версия. */
  version: string | null;
  trackNumber: number;
  durationSec: number | null;
  status: TrackStatus;
  isExclusive: boolean;
  isWip: boolean;
  isExplicit: boolean;
  credits: TrackCredit[];
  lyrics: LyricLine[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseWithTracks {
  release: Release;
  tracks: Track[];
}
