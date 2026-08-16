import { describe, it, expect } from 'vitest';
import { trackStoragePrefixes, releaseStoragePrefixes } from './storage-keys';

describe('trackStoragePrefixes', () => {
  it('накрывает мастер в vault и HLS в stream одним префиксом', () => {
    expect(trackStoragePrefixes('t1')).toEqual([
      { bucket: 'vault', prefix: 'tracks/t1/', reason: 'track.deleted', entityId: 't1' },
      { bucket: 'stream', prefix: 'tracks/t1/', reason: 'track.deleted', entityId: 't1' },
    ]);
  });
});

describe('releaseStoragePrefixes', () => {
  it('обложка релиза + префиксы всех его треков', () => {
    const result = releaseStoragePrefixes('r1', ['t1', 't2']);

    expect(result[0]).toEqual({
      bucket: 'stream', prefix: 'covers/r1.', reason: 'release.deleted', entityId: 'r1',
    });
    expect(result).toHaveLength(5);
    expect(result.every((e) => e.reason === 'release.deleted')).toBe(true);
    expect(result.filter((e) => e.entityId === 't1')).toHaveLength(2);
  });

  it('релиз без треков — только обложка', () => {
    expect(releaseStoragePrefixes('r1', [])).toHaveLength(1);
  });

  it('префикс обложки заканчивается точкой — не заденет соседний id с тем же началом', () => {
    const [cover] = releaseStoragePrefixes('abc', []);
    expect(cover.prefix).toBe('covers/abc.');
    expect('covers/abcd.jpg'.startsWith(cover.prefix)).toBe(false);
  });
});
