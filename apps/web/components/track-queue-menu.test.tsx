// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => true }));
vi.mock('@/lib/offline/download', () => ({ downloadTrack: vi.fn(), removeDownload: vi.fn() }));
vi.mock('@/lib/offline/db', () => ({ getAllTracks: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('@/lib/player/audio-engine', () => ({ controls: { enqueue: vi.fn(() => 1) } }));

import { downloadTrack, removeDownload } from '@/lib/offline/download';
import { controls } from '@/lib/player/audio-engine';
import { toast } from '@/lib/toast';
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
  vi.mocked(controls.enqueue).mockClear();
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

describe('TrackQueueMenu — без getTracks (пропсы из серверной страницы)', () => {
  it('в очередь идёт сам track', async () => {
    render(<TrackQueueMenu context={{ source: 'direct' }} track={TRACK} />);
    open();
    fireEvent.click(screen.getByText('Добавить в очередь'));
    await vi.waitFor(() => expect(controls.enqueue).toHaveBeenCalledWith([TRACK], 'end', { source: 'direct' }));
  });

  it('без getTracks и без track очередь не трогается', async () => {
    render(<TrackQueueMenu context={{ source: 'direct' }} />);
    open();
    fireEvent.click(screen.getByText('Играть следующим'));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Не удалось загрузить треки'));
    expect(controls.enqueue).not.toHaveBeenCalled();
  });
});

describe('TrackQueueMenu — вариант темы', () => {
  it('platform по умолчанию красится платформенными токенами', () => {
    render(<TrackQueueMenu getTracks={() => [TRACK]} context={{ source: 'direct' }} />);
    expect(screen.getByLabelText('Действия с очередью').className).toContain('text-muted-foreground');
  });

  it('artist берёт цвет из токенов темы артиста', () => {
    render(<TrackQueueMenu getTracks={() => [TRACK]} context={{ source: 'direct' }} variant="artist" />);
    const cls = screen.getByLabelText('Действия с очередью').className;
    expect(cls).toContain('--artist-text');
    expect(cls).not.toContain('text-muted-foreground');
  });
});
