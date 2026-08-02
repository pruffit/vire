import { describe, it, expect } from 'vitest';
import { sanitizeCoverUrl } from './cover-hosts';

describe('sanitizeCoverUrl', () => {
  it.each([
    'https://i.ytimg.com/vi/x/hqdefault.jpg',
    'https://i1.sndcdn.com/artworks-x-t500x500.jpg',
    'https://is1-ssl.mzstatic.com/image/thumb/x.jpg',
    'https://i.scdn.co/image/x',
    'https://e-cdns-images.dzcdn.net/images/cover/x/250x250.jpg',
    'https://avatars.yandex.net/get-music-content/x',
  ])('пропускает обложку с настроенного хоста: %s', (url) => {
    expect(sanitizeCoverUrl(url)).toBe(url);
  });

  it.each([
    'https://evil.example/cover.jpg',
    'http://i.ytimg.com/vi/x.jpg',
    'https://notytimg.com/x.jpg',
    'https://ytimg.com.evil.example/x.jpg',
    'javascript:alert(1)',
    'not a url',
  ])('отбрасывает чужой/небезопасный источник: %s', (url) => {
    expect(sanitizeCoverUrl(url)).toBeNull();
  });

  it('null остаётся null', () => {
    expect(sanitizeCoverUrl(null)).toBeNull();
  });
});
