// Pure validation helpers for the track-upload route handler. Kept framework-free
// so they can be unit-tested without mocking Next/DB/S3.

export type ContributorRole = 'PERFORMER' | 'LYRICIST' | 'COMPOSER' | 'PRODUCER';
export interface TrackCredit {
  name: string;
  role: ContributorRole;
}

const VALID_ROLES: ContributorRole[] = ['PERFORMER', 'LYRICIST', 'COMPOSER', 'PRODUCER'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Detect the master audio extension from a filename. Only WAV/FLAC accepted. */
export function parseAudioExt(filename: string): 'wav' | 'flac' | null {
  const name = filename.toLowerCase();
  if (name.endsWith('.wav')) return 'wav';
  if (name.endsWith('.flac')) return 'flac';
  return null;
}

/** Parse + validate the credits JSON blob from the upload form. */
export function parseCredits(raw: unknown, max = 20): TrackCredit[] {
  if (typeof raw !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (c): c is TrackCredit =>
        c !== null &&
        typeof c === 'object' &&
        typeof (c as TrackCredit).name === 'string' &&
        (c as TrackCredit).name.trim().length > 0 &&
        VALID_ROLES.includes((c as TrackCredit).role),
    )
    .slice(0, max);
}

/** Parse a positive-integer track number from a form field. */
export function parseTrackNumber(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return null;
  return n;
}
