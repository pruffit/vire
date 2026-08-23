import { describe, it, expect, vi, beforeEach } from 'vitest';

// expo-file-system замокан целиком, как react-native-track-player в audio-engine.test.ts —
// сама библиотека тянет нативный модуль, недоступный в node-окружении vitest.
const { DirectoryMock, FileMock, resetFs } = vi.hoisted(() => {
  type FsFile = { content: string; size: number };
  const files = new Map<string, FsFile>();

  class FileMock {
    uri: string;
    constructor(...parts: any[]) {
      const segments = parts.map((p) => (typeof p === 'string' ? p : p.uri.replace('file://', '')));
      this.uri = 'file://' + segments.join('/').replace(/\/+/g, '/');
    }
    get exists() {
      return files.has(this.uri);
    }
    get size() {
      return files.get(this.uri)?.size ?? 0;
    }
    write(content: string) {
      files.set(this.uri, { content, size: content.length });
    }
    textSync() {
      const f = files.get(this.uri);
      if (!f) throw new Error('not found');
      return f.content;
    }
    delete() {
      files.delete(this.uri);
    }
    static downloadFileAsync = vi.fn(async (url: string, dest: FileMock) => {
      files.set(dest.uri, { content: `data:${url}`, size: 500 });
      return dest;
    });
  }

  class DirectoryMock {
    uri: string;
    constructor(...parts: any[]) {
      const segments = parts.map((p) => (typeof p === 'string' ? p : p.uri.replace('file://', '')));
      this.uri = 'file://' + segments.join('/').replace(/\/+/g, '/');
    }
    get exists() {
      return true;
    }
    create() {}
    delete() {
      for (const key of files.keys()) {
        if (key.startsWith(this.uri)) files.delete(key);
      }
    }
  }

  return {
    DirectoryMock,
    FileMock,
    resetFs: () => {
      files.clear();
      FileMock.downloadFileAsync.mockClear();
    },
  };
});

vi.mock('expo-file-system', () => ({
  Directory: DirectoryMock,
  File: FileMock,
  Paths: { document: { uri: 'file:///document' } },
}));

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest: request }));

import {
  parseIndex,
  serializeIndex,
  sumBytes,
  downloadTrack,
  listDownloads,
  getDownloadedTrack,
  removeDownload,
  estimateUsage,
  type DownloadedTrackMeta,
} from '../offline/download-manager';

const entry = (overrides: Partial<DownloadedTrackMeta> = {}): DownloadedTrackMeta => ({
  id: 't1',
  title: 'Track',
  artistName: 'Artist',
  coverUrl: null,
  durationSec: 180,
  bytes: 1000,
  addedAt: 1000,
  localPlaylistPath: 'file:///offline/t1/playlist.m3u8',
  ...overrides,
});

describe('parseIndex', () => {
  it('парсит валидный JSON-массив', () => {
    expect(parseIndex(JSON.stringify([entry()]))).toEqual([entry()]);
  });

  it('null возвращает пустой массив', () => {
    expect(parseIndex(null)).toEqual([]);
  });

  it('битый JSON возвращает пустой массив, не бросает', () => {
    expect(parseIndex('{not json')).toEqual([]);
  });

  it('не-массив в JSON возвращает пустой массив', () => {
    expect(parseIndex('{"a":1}')).toEqual([]);
  });
});

describe('serializeIndex / parseIndex round-trip', () => {
  it('сериализация и обратный парсинг дают тот же массив', () => {
    const entries = [entry({ id: 't1' }), entry({ id: 't2', bytes: 2000 })];
    expect(parseIndex(serializeIndex(entries))).toEqual(entries);
  });
});

describe('sumBytes', () => {
  it('суммирует bytes по всем записям', () => {
    expect(sumBytes([entry({ bytes: 100 }), entry({ bytes: 250 })])).toBe(350);
  });

  it('пустой массив — 0', () => {
    expect(sumBytes([])).toBe(0);
  });
});

const PLAYLIST = ['#EXTM3U', '#EXTINF:6,', 'chunk_000.ts', '#EXTINF:6,', 'chunk_001.ts', '#EXT-X-ENDLIST', ''].join('\n');

beforeEach(() => {
  resetFs();
  request.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => PLAYLIST })),
  );
});

describe('downloadTrack', () => {
  it('скачивает манифест, плейлист и все сегменты, пишет индекс', async () => {
    request.mockResolvedValue({ ok: true, data: { hlsUrl: 'https://cdn/hls/index.m3u8', waveformPeaks: null } });

    const onProgress = vi.fn();
    const result = await downloadTrack(
      { id: 't1', title: 'Track', artistName: 'Artist', coverUrl: null, durationSec: 180 },
      onProgress,
    );

    expect(result.id).toBe('t1');
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.localPlaylistPath).toContain('playlist.m3u8');
    expect(onProgress).toHaveBeenCalledWith(2, 2);

    const listed = await listDownloads();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe('t1');
  });

  it('манифест не отдался — бросает, ничего не пишет в индекс', async () => {
    request.mockResolvedValue({ ok: false, error: { status: 404 } });

    await expect(
      downloadTrack({ id: 't1', title: 'T', artistName: 'A', coverUrl: null, durationSec: null }),
    ).rejects.toThrow();
    expect(await listDownloads()).toEqual([]);
  });
});

describe('getDownloadedTrack / removeDownload', () => {
  it('после скачивания находится по id, после удаления — нет', async () => {
    request.mockResolvedValue({ ok: true, data: { hlsUrl: 'https://cdn/hls/index.m3u8', waveformPeaks: null } });

    await downloadTrack({ id: 't1', title: 'T', artistName: 'A', coverUrl: null, durationSec: null });
    expect(await getDownloadedTrack('t1')).not.toBeNull();

    await removeDownload('t1');
    expect(await getDownloadedTrack('t1')).toBeNull();
  });

  it('трек не скачан — null', async () => {
    expect(await getDownloadedTrack('unknown')).toBeNull();
  });
});

describe('estimateUsage', () => {
  it('суммирует bytes всех скачанных треков', async () => {
    request.mockResolvedValue({ ok: true, data: { hlsUrl: 'https://cdn/hls/index.m3u8', waveformPeaks: null } });

    await downloadTrack({ id: 't1', title: 'T1', artistName: 'A', coverUrl: null, durationSec: null });
    await downloadTrack({ id: 't2', title: 'T2', artistName: 'A', coverUrl: null, durationSec: null });

    expect(await estimateUsage()).toBeGreaterThan(0);
  });

  it('ничего не скачано — 0', async () => {
    expect(await estimateUsage()).toBe(0);
  });
});
