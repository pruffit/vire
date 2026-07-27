import { describe, it, expect, vi, beforeEach } from 'vitest';

const { resize, toBuffer, sharpFn } = vi.hoisted(() => {
  const toBuffer = vi.fn();
  const jpeg = vi.fn(() => ({ toBuffer }));
  const resize = vi.fn(() => ({ jpeg }));
  const sharpFn = vi.fn(() => ({ resize }));
  return { resize, toBuffer, sharpFn };
});

vi.mock('sharp', () => ({ default: sharpFn }));

import { fetchCoverThumb } from './cover';

const okResponse = (bytes: number, contentLength: number | null = bytes) =>
  vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => (contentLength === null ? null : String(contentLength)) },
    arrayBuffer: async () => new ArrayBuffer(bytes),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('fetchCoverThumb', () => {
  it('null url → null, без сети', async () => {
    expect(await fetchCoverThumb(null)).toBeNull();
    expect(sharpFn).not.toHaveBeenCalled();
  });

  it('пустая строка → null', async () => {
    expect(await fetchCoverThumb('')).toBeNull();
  });

  it('не-ok ответ → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchCoverThumb('https://cdn.test/a.jpg')).toBeNull();
  });

  it('сетевая ошибка/таймаут → null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await fetchCoverThumb('https://cdn.test/a.jpg')).toBeNull();
  });

  it('без content-length → null, тело не буферизуем вслепую', async () => {
    vi.stubGlobal('fetch', okResponse(8, null));
    expect(await fetchCoverThumb('https://cdn.test/a.jpg')).toBeNull();
    expect(sharpFn).not.toHaveBeenCalled();
  });

  it('тело больше потолка → null, до sharp не доходит', async () => {
    vi.stubGlobal('fetch', okResponse(8, 21 * 1024 * 1024));
    expect(await fetchCoverThumb('https://cdn.test/a.jpg')).toBeNull();
    expect(sharpFn).not.toHaveBeenCalled();
  });

  it('битые байты (sharp кидает) → null', async () => {
    vi.stubGlobal('fetch', okResponse(8));
    toBuffer.mockRejectedValue(new Error('unsupported image format'));
    expect(await fetchCoverThumb('https://cdn.test/a.jpg')).toBeNull();
  });

  it('успех → data-URI из уменьшенного JPEG с потолком пикселей', async () => {
    vi.stubGlobal('fetch', okResponse(8));
    toBuffer.mockResolvedValue(Buffer.from('fake-jpeg-bytes'));

    const out = await fetchCoverThumb('https://cdn.test/a.jpg', 300);

    expect(sharpFn).toHaveBeenCalledWith(expect.any(Buffer), { limitInputPixels: 40_000_000 });
    expect(resize).toHaveBeenCalledWith(300, 300, { fit: 'cover' });
    expect(out).toBe(`data:image/jpeg;base64,${Buffer.from('fake-jpeg-bytes').toString('base64')}`);
  });
});
