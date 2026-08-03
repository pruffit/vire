import { describe, it, expect } from 'vitest';
import { parseHlsSegments } from './hls';

const MANIFEST_URL = 'https://s3.example/vault/tracks/1/hls/index.m3u8';

describe('parseHlsSegments', () => {
  it('разрешает относительные пути сегментов через manifestUrl', () => {
    const playlist = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXTINF:10.0,', 'chunk_000.ts', '#EXTINF:10.0,', 'chunk_001.ts'].join('\n');
    expect(parseHlsSegments(playlist, MANIFEST_URL)).toEqual([
      'https://s3.example/vault/tracks/1/hls/chunk_000.ts',
      'https://s3.example/vault/tracks/1/hls/chunk_001.ts',
    ]);
  });

  it('оставляет абсолютные URL как есть', () => {
    const playlist = '#EXTM3U\nhttps://cdn.example/other/chunk_000.ts\n';
    expect(parseHlsSegments(playlist, MANIFEST_URL)).toEqual(['https://cdn.example/other/chunk_000.ts']);
  });

  it('игнорирует строки-директивы (#) и пустые строки', () => {
    const playlist = '#EXTM3U\n\n#EXT-X-ENDLIST\n   \nchunk_000.ts';
    expect(parseHlsSegments(playlist, MANIFEST_URL)).toEqual(['https://s3.example/vault/tracks/1/hls/chunk_000.ts']);
  });

  it('обрезает пробелы по краям строки', () => {
    const playlist = '#EXTM3U\n  chunk_000.ts  \n';
    expect(parseHlsSegments(playlist, MANIFEST_URL)).toEqual(['https://s3.example/vault/tracks/1/hls/chunk_000.ts']);
  });

  it('понимает CRLF-переводы строк', () => {
    const playlist = '#EXTM3U\r\nchunk_000.ts\r\nchunk_001.ts\r\n';
    expect(parseHlsSegments(playlist, MANIFEST_URL)).toEqual([
      'https://s3.example/vault/tracks/1/hls/chunk_000.ts',
      'https://s3.example/vault/tracks/1/hls/chunk_001.ts',
    ]);
  });

  it('пустой плейлист даёт пустой список', () => {
    expect(parseHlsSegments('', MANIFEST_URL)).toEqual([]);
    expect(parseHlsSegments('#EXTM3U\n#EXT-X-ENDLIST', MANIFEST_URL)).toEqual([]);
  });
});
