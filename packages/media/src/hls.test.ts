import { describe, expect, it } from 'vitest';
import { parseHlsSegments, rewritePlaylistForLocalSegments } from './hls';

const PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXTINF:6.006,
chunk_000.ts
#EXTINF:6.006,
chunk_001.ts
#EXTINF:3.204,
chunk_002.ts
#EXT-X-ENDLIST
`;

describe('parseHlsSegments', () => {
  it('resolves segment URIs against the manifest URL, in order', () => {
    const segments = parseHlsSegments(PLAYLIST, 'https://cdn.example.com/hls/track-1/playlist.m3u8');
    expect(segments).toEqual([
      'https://cdn.example.com/hls/track-1/chunk_000.ts',
      'https://cdn.example.com/hls/track-1/chunk_001.ts',
      'https://cdn.example.com/hls/track-1/chunk_002.ts',
    ]);
  });

  it('ignores comment and blank lines', () => {
    const segments = parseHlsSegments('#EXTM3U\n\n  \n#EXT-X-ENDLIST\n', 'https://cdn.example.com/hls/x.m3u8');
    expect(segments).toEqual([]);
  });
});

describe('rewritePlaylistForLocalSegments', () => {
  it('substitutes each segment URI line with the corresponding local filename, in order', () => {
    const rewritten = rewritePlaylistForLocalSegments(PLAYLIST, ['seg-000.ts', 'seg-001.ts', 'seg-002.ts']);
    expect(rewritten).toBe(
      [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:6',
        '#EXTINF:6.006,',
        'seg-000.ts',
        '#EXTINF:6.006,',
        'seg-001.ts',
        '#EXTINF:3.204,',
        'seg-002.ts',
        '#EXT-X-ENDLIST',
        '',
      ].join('\n'),
    );
  });

  it('leaves #EXT-X-* tag lines and blank lines untouched', () => {
    const rewritten = rewritePlaylistForLocalSegments(PLAYLIST, ['seg-000.ts', 'seg-001.ts', 'seg-002.ts']);
    expect(rewritten).toContain('#EXT-X-VERSION:3');
    expect(rewritten).toContain('#EXT-X-TARGETDURATION:6');
    expect(rewritten).toContain('#EXT-X-ENDLIST');
  });

  it('throws when the local filename count does not match the segment count', () => {
    expect(() => rewritePlaylistForLocalSegments(PLAYLIST, ['seg-000.ts'])).toThrow();
  });

  it('round-trips through parseHlsSegments with a fake local base URL', () => {
    const rewritten = rewritePlaylistForLocalSegments(PLAYLIST, ['seg-000.ts', 'seg-001.ts', 'seg-002.ts']);
    const segments = parseHlsSegments(rewritten, 'file:///offline/track-1/playlist.m3u8');
    expect(segments).toEqual([
      'file:///offline/track-1/seg-000.ts',
      'file:///offline/track-1/seg-001.ts',
      'file:///offline/track-1/seg-002.ts',
    ]);
  });
});
