export interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Bucket {
  r: number;
  g: number;
  b: number;
  n: number;
}

/**
 * Квантование по 4 уровням на канал: 64 корзины дают устойчивые «пятна» обложки, а не
 * шум отдельных пикселей. Почти чёрное, выбеленное и серое отбрасываем — на сцене такой
 * цвет неотличим от фона и съедает слот в палитре.
 */
export function extractPalette(pixels: Uint8ClampedArray, max = 5): Rgb[] {
  const buckets = new Map<number, Bucket>();

  for (let i = 0; i < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) continue;
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const hi = Math.max(r, g, b);
    const lo = Math.min(r, g, b);
    if (hi < 45 || lo > 225 || hi - lo < 18) continue;

    const key = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((c) => ({ r: Math.round(c.r / c.n), g: Math.round(c.g / c.n), b: Math.round(c.b / c.n) }));
}

/** Через /_next/image: своё происхождение, поэтому canvas не «пачкается» и пиксели читаются. */
export function proxiedCoverUrl(coverUrl: string, width = 64): string {
  if (coverUrl.startsWith('/_next/image')) return coverUrl;
  return `/_next/image?url=${encodeURIComponent(coverUrl)}&w=${width}&q=50`;
}

export async function loadCoverPalette(coverUrl: string, size = 32): Promise<Rgb[]> {
  if (typeof document === 'undefined') return [];

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = proxiedCoverUrl(coverUrl);
  });
  if (!image) return [];

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  try {
    ctx.drawImage(image, 0, 0, size, size);
    return extractPalette(ctx.getImageData(0, 0, size, size).data);
  } catch {
    // Обложка с домена без CORS — canvas помечен «грязным», читать нельзя.
    return [];
  }
}
