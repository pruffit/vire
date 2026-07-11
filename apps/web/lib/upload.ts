// Framework-free validation helpers for the track-upload route handler.

import { isUuid, ALL_CONTRIBUTOR_ROLES, type TrackCredit, type ContributorRole } from '@vire/core';

/** Maximum accepted source-audio file size (matches proxyClientMaxBodySize). */
export const MAX_AUDIO_FILE_SIZE = 300 * 1024 * 1024; // 300 MB

export type AudioExt = 'wav' | 'flac' | 'mp3';

/** Magic-bytes check: FLAC "fLaC"; WAV "RIFF"+"WAVE"; MP3 — ID3v2 tag or raw MPEG frame sync. */
export function validateMagicBytes(header: Uint8Array, ext: AudioExt): boolean {
  if (ext === 'flac') {
    return header.length >= 4 &&
      header[0] === 0x66 && header[1] === 0x4C &&
      header[2] === 0x61 && header[3] === 0x43;
  }
  if (ext === 'mp3') {
    if (header.length < 3) return false;
    const id3 = header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33;
    const frameSync = header[0] === 0xFF && (header[1] & 0xE0) === 0xE0;
    return id3 || frameSync;
  }
  return header.length >= 12 &&
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x41 && header[10] === 0x56 && header[11] === 0x45;
}

// Реэкспорт из @vire/core сохраняет существующие импорты `@/lib/upload` в роутах.
export { isUuid, ALL_CONTRIBUTOR_ROLES };
export type { TrackCredit, ContributorRole };

/** Detect the master audio extension from a filename. WAV/FLAC/MP3 accepted. */
export function parseAudioExt(filename: string): AudioExt | null {
  const name = filename.toLowerCase();
  if (name.endsWith('.wav')) return 'wav';
  if (name.endsWith('.flac')) return 'flac';
  if (name.endsWith('.mp3')) return 'mp3';
  return null;
}

/** Validate an already-parsed array of credits: drop bad entries, trim names, cap count. */
export function sanitizeCredits(parsed: unknown, max = 20): TrackCredit[] {
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(
      (c): c is TrackCredit =>
        c !== null &&
        typeof c === 'object' &&
        typeof (c as TrackCredit).name === 'string' &&
        (c as TrackCredit).name.trim().length > 0 &&
        ALL_CONTRIBUTOR_ROLES.includes((c as TrackCredit).role),
    )
    .map((c) => ({ name: c.name.trim(), role: c.role }))
    .slice(0, max);
}

/** Parse + validate the credits JSON blob from the upload form. */
export function parseCredits(raw: unknown, max = 20): TrackCredit[] {
  if (typeof raw !== 'string') return [];
  try {
    return sanitizeCredits(JSON.parse(raw), max);
  } catch {
    return [];
  }
}

/** Parse a positive-integer track number from a form field. */
export function parseTrackNumber(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return null;
  return n;
}
