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
] as const;
export type Genre = (typeof ALL_GENRES)[number];
export type ContributorRole = 'PERFORMER' | 'FEATURED' | 'LYRICIST' | 'COMPOSER' | 'PRODUCER';

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
