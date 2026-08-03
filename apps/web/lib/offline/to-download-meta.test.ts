import { describe, it, expect } from 'vitest';
import type { PlayerTrack } from '@/store/player';
import { toDownloadMeta } from './to-download-meta';

describe('toDownloadMeta', () => {
  it('переносит поля метаданных и отбрасывает лишние поля PlayerTrack', () => {
    const track: PlayerTrack = {
      id: 't1',
      title: 'Track',
      artistName: 'Artist',
      coverUrl: 'https://cdn.example/cover.jpg',
      artistSlug: 'artist',
      releaseId: 'r1',
      accentColor: '#fff',
      isExplicit: true,
      version: 'Remix',
      feat: ['Feat Name'],
      localFileId: 'local-1',
    };

    expect(toDownloadMeta(track)).toEqual({
      id: 't1',
      title: 'Track',
      artistName: 'Artist',
      coverUrl: 'https://cdn.example/cover.jpg',
      artistSlug: 'artist',
      releaseId: 'r1',
      isExplicit: true,
      version: 'Remix',
    });
  });

  it('опциональные поля PlayerTrack остаются undefined, если их нет', () => {
    const track: PlayerTrack = {
      id: 't2',
      title: 'Track 2',
      artistName: 'Artist',
      coverUrl: null,
    };

    expect(toDownloadMeta(track)).toEqual({
      id: 't2',
      title: 'Track 2',
      artistName: 'Artist',
      coverUrl: null,
      artistSlug: undefined,
      releaseId: undefined,
      isExplicit: undefined,
      version: undefined,
    });
  });
});
