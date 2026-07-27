import sharp from 'sharp';

// Потолки против OOM на VPS с 1 ГБ: тело не буферизуем без известного и вменяемого размера,
// декод ограничиваем по пикселям (COVER_POLICY разрешает 6000×6000 = 36 Мп).
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 40_000_000;

// Без предварительного ужатия resvg декодировал бы оригинал (6000×6000 RGBA ≈ 144 МБ на кадр).
export async function fetchCoverThumb(url: string | null, size = 600): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const declared = Number(res.headers.get('content-length'));
    if (!Number.isFinite(declared) || declared <= 0 || declared > MAX_SOURCE_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_SOURCE_BYTES) return null;

    const jpeg = await sharp(buf, { limitInputPixels: MAX_SOURCE_PIXELS })
      .resize(size, size, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}
