import { describe, it, expect } from 'vitest';
import { getEmbedUrl } from '../embed';

describe('getEmbedUrl — YouTube', () => {
  it('parses youtube.com/watch?v=', () => {
    expect(getEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('parses youtube.com without www', () => {
    expect(getEmbedUrl('https://youtube.com/watch?v=dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('parses youtu.be short link', () => {
    expect(getEmbedUrl('https://youtu.be/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('parses youtube.com/shorts/', () => {
    expect(getEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('parses youtube.com/watch with extra query params', () => {
    expect(getEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'))
      .toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
  });

  it('returns null for youtube.com without v param', () => {
    expect(getEmbedUrl('https://www.youtube.com/channel/UC123')).toBeNull();
  });

  it('returns null for youtu.be with empty path', () => {
    expect(getEmbedUrl('https://youtu.be/')).toBeNull();
  });
});

describe('getEmbedUrl — VK', () => {
  it('parses vk.com/video{oid}_{id} format', () => {
    expect(getEmbedUrl('https://vk.com/video-12345_67890'))
      .toBe('https://vk.com/video_ext.php?oid=-12345&id=67890&hd=2');
  });

  it('parses vk.com/video{oid}_{id} with positive oid', () => {
    expect(getEmbedUrl('https://vk.com/video12345_67890'))
      .toBe('https://vk.com/video_ext.php?oid=12345&id=67890&hd=2');
  });

  it('parses vk.com with www prefix', () => {
    expect(getEmbedUrl('https://www.vk.com/video-12345_67890'))
      .toBe('https://vk.com/video_ext.php?oid=-12345&id=67890&hd=2');
  });

  it('parses vk.com with ?z= param', () => {
    expect(getEmbedUrl('https://vk.com/video?z=video-12345_67890'))
      .toBe('https://vk.com/video_ext.php?oid=-12345&id=67890&hd=2');
  });

  it('returns null for vk.com with unrecognized path', () => {
    expect(getEmbedUrl('https://vk.com/wall-12345_67890')).toBeNull();
  });
});

describe('getEmbedUrl — invalid input', () => {
  it('returns null for empty string', () => {
    expect(getEmbedUrl('')).toBeNull();
  });

  it('returns null for non-URL string', () => {
    expect(getEmbedUrl('not a url')).toBeNull();
  });

  it('returns null for unrelated domain', () => {
    expect(getEmbedUrl('https://soundcloud.com/artist/track')).toBeNull();
  });

  it('returns null for bare domain', () => {
    expect(getEmbedUrl('https://youtube.com')).toBeNull();
  });
});
