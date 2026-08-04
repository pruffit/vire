import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { offlineCoverUrl, releaseOfflineCoverUrl, releaseAllOfflineCoverUrls } from './cover-url';

const CDN_URL = 'https://cdn.example/covers/t1.jpg';

let created = 0;
const revoked: string[] = [];

beforeEach(() => {
  created = 0;
  revoked.length = 0;
  vi.stubGlobal('URL', {
    createObjectURL: () => `blob:fake/${++created}`,
    revokeObjectURL: (url: string) => { revoked.push(url); },
  });
});

afterEach(() => {
  releaseAllOfflineCoverUrls();
  vi.unstubAllGlobals();
});

describe('offlineCoverUrl', () => {
  it('без blob отдаёт исходный URL обложки', () => {
    expect(offlineCoverUrl({ id: 'a', coverUrl: CDN_URL })).toBe(CDN_URL);
    expect(created).toBe(0);
  });

  it('без blob и без URL отдаёт null', () => {
    expect(offlineCoverUrl({ id: 'a', coverUrl: null })).toBeNull();
  });

  it('с blob создаёт object URL один раз на трек', () => {
    const track = { id: 'a', coverUrl: CDN_URL, coverBlob: new Blob(['x']) };
    const first = offlineCoverUrl(track);
    const second = offlineCoverUrl(track);
    expect(first).toBe('blob:fake/1');
    expect(second).toBe(first);
    expect(created).toBe(1);
  });

  it('разные треки получают разные URL', () => {
    const a = offlineCoverUrl({ id: 'a', coverUrl: CDN_URL, coverBlob: new Blob(['x']) });
    const b = offlineCoverUrl({ id: 'b', coverUrl: CDN_URL, coverBlob: new Blob(['y']) });
    expect(a).not.toBe(b);
  });

  it('release отзывает URL и следующий вызов создаёт новый', () => {
    const track = { id: 'a', coverUrl: CDN_URL, coverBlob: new Blob(['x']) };
    const first = offlineCoverUrl(track);
    releaseOfflineCoverUrl('a');
    expect(revoked).toEqual([first]);
    expect(offlineCoverUrl(track)).toBe('blob:fake/2');
  });

  it('releaseAll отзывает все выданные URL', () => {
    offlineCoverUrl({ id: 'a', coverUrl: CDN_URL, coverBlob: new Blob(['x']) });
    offlineCoverUrl({ id: 'b', coverUrl: CDN_URL, coverBlob: new Blob(['y']) });
    releaseAllOfflineCoverUrls();
    expect(revoked).toHaveLength(2);
  });

  it('release неизвестного трека — no-op', () => {
    releaseOfflineCoverUrl('missing');
    expect(revoked).toEqual([]);
  });
});
