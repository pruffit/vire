// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { OfflineTrack } from '@/lib/offline/db';

const { playQueueMock, toggleMock } = vi.hoisted(() => ({
  playQueueMock: vi.fn(),
  toggleMock: vi.fn(),
}));

vi.mock('@/lib/offline/db', () => ({ getAllTracks: vi.fn() }));
vi.mock('@/lib/offline/download', () => ({
  removeDownload: vi.fn(),
  estimateUsage: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
}));
vi.mock('@/lib/player/audio-engine', () => ({ controls: { playQueue: playQueueMock, toggle: toggleMock } }));
vi.mock('@/lib/player/use-play', () => ({ useTrackPlayState: () => ({ isActive: false, isPlaying: false }) }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { getAllTracks } from '@/lib/offline/db';
import { removeDownload } from '@/lib/offline/download';
import { useOfflineStore } from '@/store/offline';
import { OfflineScreen } from './offline-screen';

function fakeTrack(id: string, status: OfflineTrack['status'] = 'done'): OfflineTrack {
  return {
    id, title: `Track ${id}`, artistName: 'Artist', coverUrl: null,
    hlsUrl: 'https://example.com/index.m3u8', segmentUrls: ['s1'], bytes: 5 * 1024 * 1024,
    addedAt: Date.now(), status,
  };
}

beforeEach(() => {
  useOfflineStore.setState({ entries: new Map(), hydrated: true });
  vi.mocked(getAllTracks).mockReset();
  vi.mocked(removeDownload).mockReset();
});
afterEach(() => cleanup());

describe('OfflineScreen', () => {
  it('пусто — показывает EmptyState', async () => {
    vi.mocked(getAllTracks).mockResolvedValue([]);
    render(<OfflineScreen />);
    expect(await screen.findByText('Пока нет скачанного')).toBeTruthy();
  });

  it('список скачанного — рендерит строки и запускает воспроизведение по клику', async () => {
    vi.mocked(getAllTracks).mockResolvedValue([fakeTrack('t1'), fakeTrack('t2')]);
    render(<OfflineScreen />);

    await screen.findByText('Track t1');
    fireEvent.click(screen.getByLabelText('Играть Track t1'));
    expect(playQueueMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 't1' })]),
      expect.objectContaining({ startIndex: 0 }),
    );
  });

  it('удаление трека — оптимистично убирает строку, откатывает при ошибке', async () => {
    vi.mocked(getAllTracks).mockResolvedValue([fakeTrack('t1')]);
    vi.mocked(removeDownload).mockRejectedValue(new Error('boom'));
    render(<OfflineScreen />);

    await screen.findByText('Track t1');
    fireEvent.click(screen.getByLabelText('Удалить из офлайна'));
    expect(screen.queryByText('Track t1')).toBeNull();

    await waitFor(() => expect(screen.getByText('Track t1')).toBeTruthy());
  });

  it('удаление трека — успех оставляет строку убранной', async () => {
    vi.mocked(getAllTracks).mockResolvedValue([fakeTrack('t1')]);
    vi.mocked(removeDownload).mockResolvedValue(undefined);
    render(<OfflineScreen />);

    await screen.findByText('Track t1');
    fireEvent.click(screen.getByLabelText('Удалить из офлайна'));

    await waitFor(() => expect(removeDownload).toHaveBeenCalledWith('t1'));
    expect(screen.queryByText('Track t1')).toBeNull();
  });

  it('кнопка сброса кэша требует подтверждения перед показом «Да, сбросить»', async () => {
    vi.mocked(getAllTracks).mockResolvedValue([]);
    render(<OfflineScreen />);

    await screen.findByText('Пока нет скачанного');
    expect(screen.queryByText('Да, сбросить')).toBeNull();
    fireEvent.click(screen.getByText('Сбросить кэш приложения'));
    expect(screen.getByText('Да, сбросить')).toBeTruthy();
  });
});
