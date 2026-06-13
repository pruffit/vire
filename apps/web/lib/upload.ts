// Pure validation helpers for the track-upload route handler. Kept framework-free
// so they can be unit-tested without mocking Next/DB/S3.

/** Maximum accepted source-audio file size (matches proxyClientMaxBodySize). */
export const MAX_AUDIO_FILE_SIZE = 300 * 1024 * 1024; // 300 MB

export type AudioExt = 'wav' | 'flac' | 'mp3';

/**
 * Check that the first bytes of the file match the expected audio container.
 * FLAC: "fLaC" (4 bytes). WAV: "RIFF" at 0-3 + "WAVE" at 8-11 (12 bytes).
 * MP3: ID3v2 tag ("ID3") or a raw MPEG frame sync (0xFF Ex/Fx).
 */
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

export interface WavFormat {
  /** true for uncompressed PCM (audioFormat 1, or EXTENSIBLE with a PCM SubFormat). */
  isPcm: boolean;
  sampleRate: number;
  bitsPerSample: number;
}

/**
 * Parse the WAV `fmt ` chunk to read codec + sample format. Returns null if the
 * buffer isn't a RIFF/WAVE file or no `fmt ` chunk is found within it.
 *
 * Scans chunks rather than assuming `fmt ` sits at offset 12 — some encoders
 * (Pro Tools, broadcast WAV) prepend JUNK/bext chunks. Handles
 * WAVE_FORMAT_EXTENSIBLE (0xFFFE) by reading the SubFormat GUID's leading tag,
 * so genuine 24-bit PCM masters (which usually use EXTENSIBLE) aren't flagged
 * as non-PCM.
 */
export function parseWavFormat(buf: Uint8Array): WavFormat | null {
  if (buf.length < 16) return null;
  const isRiff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
  const isWave = buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45;
  if (!isRiff || !isWave) return null;

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const isFmt =
      buf[offset] === 0x66 && buf[offset + 1] === 0x6D &&
      buf[offset + 2] === 0x74 && buf[offset + 3] === 0x20; // "fmt "
    const size = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    if (isFmt) {
      if (dataStart + 16 > buf.length) return null;
      const audioFormat = view.getUint16(dataStart, true);
      const sampleRate = view.getUint32(dataStart + 4, true);
      const bitsPerSample = view.getUint16(dataStart + 14, true);
      let isPcm = audioFormat === 1;
      if (audioFormat === 0xFFFE && dataStart + 26 <= buf.length) {
        // EXTENSIBLE: the real codec tag is the first 2 bytes of the SubFormat GUID.
        isPcm = view.getUint16(dataStart + 24, true) === 1;
      }
      return { isPcm, sampleRate, bitsPerSample };
    }
    // Chunks are word-aligned: odd sizes carry a trailing pad byte.
    offset = dataStart + size + (size % 2);
  }
  return null;
}

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

/** Detect the master audio extension from a filename. WAV/FLAC/MP3 accepted. */
export function parseAudioExt(filename: string): AudioExt | null {
  const name = filename.toLowerCase();
  if (name.endsWith('.wav')) return 'wav';
  if (name.endsWith('.flac')) return 'flac';
  if (name.endsWith('.mp3')) return 'mp3';
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
