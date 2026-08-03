// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => true }));
vi.mock('@/lib/offline/download', () => ({ downloadTrack: vi.fn(), removeDownload: vi.fn() }));
vi.mock('@/lib/offline/db', () => ({ getAllTracks: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { downloadTrack, removeDownload } from '@/lib/offline/download';
import { useOfflineStore } from '@/store/offline';
import type { PlayerTrack } from '@/store/player';
import { TrackQueueMenu } from './track-queue-menu';

const TRACK: PlayerTrack = { id: 't1', title: 'Track', artistName: 'Artist', coverUrl: null, artistSlug: 'a', releaseId: 'r1' };

function open() {
  fireEvent.click(screen.getByLabelText('Действия с очередью'));
}

beforeEach(() => {
  useOfflineStore.setState({ entries: new Map(), hydrated: true });
  vi.mocked(downloadTrack).mockReset();
  vi.mocked(removeDownload).mockReset();
});
afterEach(() => cleanup());

describe('TrackQueueMenu — офлайн-пункт', () => {
  it('без track — пункта офлайна нет', () => {
    render(<TrackQueueMenu getTracks={() => [TRACK]} context={{ source: 'direct' }} />);
    open();
    expect(screen.getByText('Играть следующим')).toBeTruthy();
    expect(screen.queryByText(/офлайн/i)).toBeNull();
  });

  it('idle — «Сохранить офлайн», клик запускает download() с метаданными трека', () => {
    vi.mocked(downloadTrack).mockResolvedValue({
      id: 't1', title: 'Track', artistName: 'Artist', coverUrl: null,
      hlsUrl: 'https://example.com/index.m3u8', segmentUrls: [], bytes: 0, addedAt: Date.now(), status: 'done',
    });
    render(<TrackQueueMenu getTracks={() => [TRACK]} context={{ source: 'direct' }} track={TRACK} />);
    open();
    fireEvent.click(screen.getByText('Сохранить офлайн'));
    expect(downloadTrack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', title: 'Track', artistSlug: 'a', releaseId: 'r1' }),
      expect.anything(),
    );
  });

  it('downloading — показывает прогресс в лейбле', () => {
    useOfflineStore.setState({ entries: new Map([['t1', { status: 'downloading', done: 2, total: 5 }]]), hydrated: true });
    render(<TrackQueueMenu getTracks={() => [TRACK]} context={{ source: 'direct' }} track={TRACK} />);
    open();
    expect(screen.getByText('Сохраняю… 40%')).toBeTruthy();
  });

  it('done — «Удалить из офлайна», клик вызывает removeDownload', () => {
    vi.mocked(removeDownload).mockResolvedValue(undefined);
    useOfflineStore.setState({ entries: new Map([['t1', { status: 'done', done: 3, total: 3 }]]), hydrated: true });
    render(<TrackQueueMenu getTracks={() => [TRACK]} context={{ source: 'direct' }} track={TRACK} />);
    open();
    fireEvent.click(screen.getByText('Удалить из офлайна'));
    expect(removeDownload).toHaveBeenCalledWith('t1');
  });

  it('partial — «Докачать офлайн»', () => {
    useOfflineStore.setState({ entries: new Map([['t1', { status: 'partial', done: 1, total: 3 }]]), hydrated: true });
    render(<TrackQueueMenu getTracks={() => [TRACK]} context={{ source: 'direct' }} track={TRACK} />);
    open();
    expect(screen.getByText('Докачать офлайн')).toBeTruthy();
  });
});
