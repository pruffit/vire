// Image-header parsing + upload-policy validation (JPEG/PNG/WebP). Reads real bytes,
// not client-provided Content-Type — a spoofed MIME can't smuggle a wrong format past validation.

export type ImageExt = 'jpg' | 'png' | 'webp';

export interface ImageInfo {
  ext: ImageExt;
  mime: string;
  width: number;
  height: number;
}

function u16be(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}
function u32be(b: Uint8Array, o: number): number {
  // Avoid sign issues on the top bit (width/height fit in 31 bits).
  return b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
}
function u16le(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8);
}
function u24le(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
}

/** PNG: dimensions live in the IHDR chunk immediately after the 8-byte signature. */
function pngDims(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24) return null;
  const ihdr = b[12] === 0x49 && b[13] === 0x48 && b[14] === 0x44 && b[15] === 0x52;
  if (!ihdr) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

/** JPEG: scan segment markers for an SOFn frame header (carries width/height). */
function jpegDims(b: Uint8Array): { width: number; height: number } | null {
  let o = 2; // skip SOI (FF D8)
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) { o++; continue; } // resync to the next marker
    const marker = b[o + 1];
    o += 2;
    if (marker === 0xff) { o--; continue; } // padding run of 0xFF
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (o + 2 > b.length) break;
    const len = u16be(b, o);
    if (len < 2) break;
    // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC) → frame headers with dimensions.
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      if (o + 7 > b.length) break;
      return { width: u16be(b, o + 5), height: u16be(b, o + 3) };
    }
    o += len;
  }
  return null;
}

/** WebP: handles the three container variants — VP8 (lossy), VP8L, VP8X (extended). */
function webpDims(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 30) return null;
  const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (fourcc === 'VP8 ') {
    if (!(b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a)) return null; // keyframe start code
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    if (b[20] !== 0x2f) return null; // lossless signature byte
    const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }
  if (fourcc === 'VP8X') {
    return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  }
  return null;
}

/** Identify format + dimensions from the file header. Null = not a JPEG/PNG/WebP. */
export function probeImage(b: Uint8Array): ImageInfo | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const d = pngDims(b);
    return d ? { ext: 'png', mime: 'image/png', ...d } : null;
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const d = jpegDims(b);
    return d ? { ext: 'jpg', mime: 'image/jpeg', ...d } : null;
  }
  const isRiffWebp =
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; // WEBP
  if (isRiffWebp) {
    const d = webpDims(b);
    return d ? { ext: 'webp', mime: 'image/webp', ...d } : null;
  }
  return null;
}

export interface ImagePolicy {
  /** Used in error messages, e.g. 'Обложка' / 'Аватар'. */
  label: string;
  maxBytes: number;
  /** Minimum width AND height in pixels. */
  minDimension: number;
  /** Maximum width AND height — guards against decompression-bomb sizes. */
  maxDimension: number;
  /** Require an exact 1:1 square. */
  square: boolean;
  /** When not square: max allowed max(w/h, h/w). */
  maxAspect: number;
}

// Обложка релиза: строго квадрат, минимум 1400×1400 (рекомендуем 3000 — в форме).
export const COVER_POLICY: ImagePolicy = {
  label: 'Обложка',
  maxBytes: 15 * 1024 * 1024,
  minDimension: 1400,
  maxDimension: 6000,
  square: true,
  maxAspect: 1,
};

// Широкая обложка профиля: пейзаж ~3:1, минимум 400px по меньшей стороне; потолок
// 4000px — с запасом на retina при рендере высотой ≤320px.
export const HEADER_POLICY: ImagePolicy = {
  label: 'Шапка профиля',
  maxBytes: 8 * 1024 * 1024,
  minDimension: 400,
  maxDimension: 4000,
  square: false,
  maxAspect: 6,
};

// Аватар (артист и слушатель): около-квадрат (≤ 2:1), минимум 400×400.
export const AVATAR_POLICY: ImagePolicy = {
  label: 'Аватар',
  maxBytes: 5 * 1024 * 1024,
  minDimension: 400,
  maxDimension: 4000,
  square: false,
  maxAspect: 2,
};

// Обложка плейлиста: около-квадрат (≤ 2:1), минимум 300×300.
export const PLAYLIST_COVER_POLICY: ImagePolicy = {
  label: 'Обложка плейлиста',
  maxBytes: 5 * 1024 * 1024,
  minDimension: 300,
  maxDimension: 4000,
  square: false,
  maxAspect: 2,
};

export type ImageValidation =
  | { ok: true; info: ImageInfo }
  | { ok: false; status: number; error: string };

/** Validate a buffered image upload against a policy. Returns the detected format on success. */
export function validateImageUpload(size: number, buf: Uint8Array, p: ImagePolicy): ImageValidation {
  const info = probeImage(buf);
  if (!info) return { ok: false, status: 400, error: 'Только JPEG, PNG или WebP' };

  if (size > p.maxBytes) {
    return { ok: false, status: 413, error: `Файл больше ${Math.round(p.maxBytes / 1024 / 1024)} МБ` };
  }

  const { width, height } = info;
  // Для квадратной обложки осмысленно «N×N»; для непрямоугольных (шапка/аватар) —
  // «N px по стороне», иначе «6000×6000» сбивает с толку у широкого баннера.
  const dim = (n: number) => (p.square ? `${n}×${n} px` : `${n} px по стороне`);
  if (width < p.minDimension || height < p.minDimension) {
    return { ok: false, status: 400, error: `${p.label}: минимум ${dim(p.minDimension)}` };
  }
  if (width > p.maxDimension || height > p.maxDimension) {
    return { ok: false, status: 400, error: `${p.label}: максимум ${dim(p.maxDimension)}` };
  }

  if (p.square) {
    if (width !== height) {
      return { ok: false, status: 400, error: `${p.label} должна быть квадратной (1:1)` };
    }
  } else {
    const aspect = Math.max(width / height, height / width);
    if (aspect > p.maxAspect) {
      return {
        ok: false,
        status: 400,
        error: `${p.label}: соотношение сторон ближе к квадрату (макс. ${p.maxAspect}:1)`,
      };
    }
  }

  return { ok: true, info };
}
