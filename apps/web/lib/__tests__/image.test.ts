import { describe, it, expect } from 'vitest';
import { probeImage, validateImageUpload, COVER_POLICY, AVATAR_POLICY } from '../image';

// --- Minimal valid headers for each format we accept --------------------------

function makePng(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  b.set([0x00, 0x00, 0x00, 0x0d], 8); // IHDR length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(b.buffer).setUint32(16, w, false); // width  (big-endian)
  new DataView(b.buffer).setUint32(20, h, false); // height (big-endian)
  return b;
}

function makeJpeg(w: number, h: number): Uint8Array {
  const b = new Uint8Array(20);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08], 0); // SOI + SOF0 + len + precision
  new DataView(b.buffer).setUint16(7, h, false); // height
  new DataView(b.buffer).setUint16(9, w, false); // width
  return b;
}

function makeWebpVp8x(w: number, h: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  const wm = w - 1, hm = h - 1;
  b[24] = wm & 0xff; b[25] = (wm >> 8) & 0xff; b[26] = (wm >> 16) & 0xff; // width-1 (24-bit LE)
  b[27] = hm & 0xff; b[28] = (hm >> 8) & 0xff; b[29] = (hm >> 16) & 0xff; // height-1
  return b;
}

function makeWebpVp8l(w: number, h: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0);
  b.set([0x57, 0x45, 0x42, 0x50], 8);
  b.set([0x56, 0x50, 0x38, 0x4c], 12); // VP8L
  b[20] = 0x2f; // signature
  const W = w - 1, H = h - 1; // each 14-bit
  b[21] = W & 0xff;
  b[22] = ((W >> 8) & 0x3f) | ((H & 0x03) << 6);
  b[23] = (H >> 2) & 0xff;
  b[24] = (H >> 10) & 0x0f;
  return b;
}

function makeWebpVp8(w: number, h: number): Uint8Array {
  const b = new Uint8Array(30);
  b.set([0x52, 0x49, 0x46, 0x46], 0);
  b.set([0x57, 0x45, 0x42, 0x50], 8);
  b.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
  b.set([0x9d, 0x01, 0x2a], 23); // keyframe start code
  b[26] = w & 0xff; b[27] = (w >> 8) & 0x3f;
  b[28] = h & 0xff; b[29] = (h >> 8) & 0x3f;
  return b;
}

describe('probeImage', () => {
  it('reads PNG dimensions', () => {
    expect(probeImage(makePng(3000, 3000))).toEqual({ ext: 'png', mime: 'image/png', width: 3000, height: 3000 });
  });
  it('reads JPEG dimensions from the SOF frame', () => {
    expect(probeImage(makeJpeg(1920, 1080))).toEqual({ ext: 'jpg', mime: 'image/jpeg', width: 1920, height: 1080 });
  });
  it('reads WebP VP8X (extended)', () => {
    expect(probeImage(makeWebpVp8x(2000, 2000))).toEqual({ ext: 'webp', mime: 'image/webp', width: 2000, height: 2000 });
  });
  it('reads WebP VP8L (lossless)', () => {
    expect(probeImage(makeWebpVp8l(1500, 1500))).toEqual({ ext: 'webp', mime: 'image/webp', width: 1500, height: 1500 });
  });
  it('reads WebP VP8 (lossy)', () => {
    expect(probeImage(makeWebpVp8(1600, 1600))).toEqual({ ext: 'webp', mime: 'image/webp', width: 1600, height: 1600 });
  });
  it('returns null for a non-image / unsupported format', () => {
    expect(probeImage(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // "GIF8"
    expect(probeImage(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe('validateImageUpload — COVER_POLICY (square, ≥1400)', () => {
  const ok = (buf: Uint8Array, size = 1_000_000) => validateImageUpload(size, buf, COVER_POLICY);

  it('accepts a square 3000×3000 cover', () => {
    const r = ok(makePng(3000, 3000));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.info.ext).toBe('png');
  });
  it('rejects a non-square cover', () => {
    const r = ok(makeJpeg(3000, 2000));
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.error).toMatch(/квадрат/i);
  });
  it('rejects a cover below 1400×1400', () => {
    const r = ok(makePng(1000, 1000));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toMatch(/минимум/i);
  });
  it('rejects an oversized file', () => {
    const r = ok(makePng(3000, 3000), 20 * 1024 * 1024);
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
  it('rejects a non-image', () => {
    const r = ok(new Uint8Array([0x47, 0x49, 0x46]));
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.error).toMatch(/JPEG|PNG|WebP/);
  });
});

describe('validateImageUpload — AVATAR_POLICY (near-square, ≥400)', () => {
  const ok = (buf: Uint8Array, size = 500_000) => validateImageUpload(size, buf, AVATAR_POLICY);

  it('accepts an exact square avatar', () => {
    expect(ok(makePng(800, 800)).ok).toBe(true);
  });
  it('accepts a near-square avatar (aspect 1.6)', () => {
    expect(ok(makeJpeg(500, 800)).ok).toBe(true);
  });
  it('rejects an over-stretched avatar (aspect 3)', () => {
    const r = ok(makeJpeg(500, 1500));
    expect(r).toMatchObject({ ok: false, status: 400 });
    if (!r.ok) expect(r.error).toMatch(/соотношение/i);
  });
  it('rejects an avatar below 400×400', () => {
    expect(ok(makePng(300, 300)).ok).toBe(false);
  });
});
