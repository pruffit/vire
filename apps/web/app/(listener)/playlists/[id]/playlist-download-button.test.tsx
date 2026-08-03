// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('@/lib/offline/download', () => ({
  downloadTrack: vi.fn(),
  removeDownload: vi.fn(),
}));
vi.mock('@/lib/offline/db', () => ({ getAllTracks: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { downloadTrack } from '@/lib/offline/download';
import { useOfflineStore } from '@/store/offline';
import type { PlayerTrack } from '@/store/player';
import { PlaylistDownloadButton } from './playlist-download-button';

function track(id: string): PlayerTrack {
  return { id, title: `Track ${id}`, artistName: 'Artist', coverUrl: null };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function fakeTrack(id: string, status: 'done' | 'partial') {
  return {
    id, title: `Track ${id}`, artistName: 'Artist', coverUrl: null,
    hlsUrl: 'https://example.com/index.m3u8', segmentUrls: ['s1'], bytes: 10,
    addedAt: Date.now(), status,
  };
}

beforeEach(() => {
  useOfflineStore.setState({ entries: new Map(), hydrated: true });
  vi.mocked(downloadTrack).mockReset();
});
afterEach(() => cleanup());

describe('PlaylistDownloadButton', () => {
  it('плейлист без треков — ничего не рендерит', () => {
    const { container } = render(<PlaylistDownloadButton tracks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('все треки уже done — показывает «Скачано офлайн» без клика', () => {
    useOfflineStore.setState({
      entries: new Map([['t1', { status: 'done', done: 1, total: 1 }]]),
      hydrated: true,
    });
    render(<PlaylistDownloadButton tracks={[track('t1')]} />);
    expect(screen.getByText('Скачано офлайн')).toBeTruthy();
  });

  it('клик запускает последовательную загрузку с прогрессом и завершается', async () => {
    const d1 = deferred<ReturnType<typeof fakeTrack>>();
    const d2 = deferred<ReturnType<typeof fakeTrack>>();
    vi.mocked(downloadTrack)
      .mockReturnValueOnce(d1.promise as never)
      .mockReturnValueOnce(d2.promise as never);

    render(<PlaylistDownloadButton tracks={[track('t1'), track('t2')]} />);

    fireEvent.click(screen.getByText('Скачать плейлист'));
    expect(await screen.findByText('Скачиваю 0/2')).toBeTruthy();
    expect(downloadTrack).toHaveBeenCalledTimes(1);

    await act(async () => {
      d1.resolve(fakeTrack('t1', 'done'));
      await d1.promise;
    });
    expect(await screen.findByText('Скачиваю 1/2')).toBeTruthy();
    expect(downloadTrack).toHaveBeenCalledTimes(2);

    await act(async () => {
      d2.resolve(fakeTrack('t2', 'done'));
      await d2.promise;
    });
    expect(await screen.findByText('Скачано офлайн')).toBeTruthy();
  });

  it('отмена во время загрузки останавливает очередь и не идёт ко второму треку', async () => {
    const d1 = deferred<ReturnType<typeof fakeTrack>>();
    vi.mocked(downloadTrack).mockReturnValueOnce(d1.promise as never);

    render(<PlaylistDownloadButton tracks={[track('t1'), track('t2')]} />);
    fireEvent.click(screen.getByText('Скачать плейлист'));
    await screen.findByText('Скачиваю 0/2');

    fireEvent.click(screen.getByText('Скачиваю 0/2'));

    await act(async () => {
      d1.resolve(fakeTrack('t1', 'partial'));
      await d1.promise;
    });

    await screen.findByText('Скачать плейлист');
    expect(downloadTrack).toHaveBeenCalledTimes(1);
  });
});
