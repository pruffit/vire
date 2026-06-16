import { describe, it, expect } from 'vitest';
import { detectPlatform, linkLabel } from '../platforms';

describe('detectPlatform', () => {
  it('распознаёт основные стриминги', () => {
    expect(detectPlatform('https://open.spotify.com/album/123').key).toBe('spotify');
    expect(detectPlatform('https://music.apple.com/ru/album/x/1').key).toBe('apple_music');
    expect(detectPlatform('https://music.youtube.com/watch?v=x').key).toBe('youtube_music');
    expect(detectPlatform('https://youtu.be/abc').key).toBe('youtube');
    expect(detectPlatform('https://www.youtube.com/watch?v=x').key).toBe('youtube');
    expect(detectPlatform('https://music.yandex.ru/album/123').key).toBe('yandex_music');
    expect(detectPlatform('https://zvuk.com/release/123').key).toBe('zvuk');
    expect(detectPlatform('https://soundcloud.com/artist/track').key).toBe('soundcloud');
    expect(detectPlatform('https://artist.bandcamp.com/album/x').key).toBe('bandcamp');
  });

  it('различает VK музыку и VK профиль', () => {
    expect(detectPlatform('https://vk.com/music/album/x').key).toBe('vk_music');
    expect(detectPlatform('https://vk.com/artistpage').key).toBe('vk');
  });

  it('распознаёт соцсети', () => {
    expect(detectPlatform('https://t.me/channel').key).toBe('telegram');
    expect(detectPlatform('https://instagram.com/user').key).toBe('instagram');
    expect(detectPlatform('https://www.tiktok.com/@user').key).toBe('tiktok');
    expect(detectPlatform('https://x.com/user').key).toBe('x');
    expect(detectPlatform('https://twitter.com/user').key).toBe('x');
    expect(detectPlatform('https://facebook.com/page').key).toBe('facebook');
    expect(detectPlatform('https://bsky.app/profile/x').key).toBe('bluesky');
    expect(detectPlatform('https://discord.gg/abc').key).toBe('discord');
    expect(detectPlatform('https://twitch.tv/streamer').key).toBe('twitch');
    expect(detectPlatform('https://www.bandsintown.com/a/123').key).toBe('bandsintown');
  });

  it('распознаёт дополнительные стриминги', () => {
    expect(detectPlatform('https://www.deezer.com/album/123').key).toBe('deezer');
    expect(detectPlatform('https://tidal.com/browse/album/123').key).toBe('tidal');
    expect(detectPlatform('https://music.amazon.com/albums/123').key).toBe('amazon_music');
    expect(detectPlatform('https://www.bandlab.com/artist').key).toBe('bandlab');
  });

  it('неизвестный домен → website с именем хоста', () => {
    const d = detectPlatform('https://example.com/page');
    expect(d.key).toBe('website');
    expect(d.name).toBe('example.com');
  });

  it('невалидный URL → website', () => {
    expect(detectPlatform('not a url').key).toBe('website');
  });
});

describe('linkLabel', () => {
  it('подпись пользователя приоритетнее распознанной', () => {
    expect(linkLabel('https://open.spotify.com/x', 'Мой Spotify')).toBe('Мой Spotify');
  });
  it('без подписи — название площадки', () => {
    expect(linkLabel('https://open.spotify.com/x')).toBe('Spotify');
    expect(linkLabel('https://open.spotify.com/x', '   ')).toBe('Spotify');
  });
});
