// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => true }));
vi.mock('@/lib/offline/download', () => ({ downloadTrack: vi.fn(), removeDownload: vi.fn() }));
vi.mock('@/lib/offline/db', () => ({ getAllTracks: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('@/lib/player/audio-engine', () => ({ controls: { enqueue: vi.fn(), playQueue: vi.fn(), jumpTo: vi.fn(), setQueue: vi.fn() } }));

import { usePlayerStore, type PlayerTrack } from '@/store/player';
import { QueuePanel } from './queue-panel';

const TRACK: PlayerTrack = { id: 't1', title: 'Track', artistName: 'Artist', coverUrl: null, artistSlug: 'a', releaseId: 'r1' };
const LOCAL: PlayerTrack = { id: 'l1', title: 'Local', artistName: 'Me', coverUrl: null, localFileId: 'file-1' };

beforeEach(() => {
  usePlayerStore.setState({ queue: [TRACK, LOCAL], track: TRACK });
});
afterEach(() => cleanup());

describe('QueuePanel — меню трека', () => {
  it('каталожный трек получает меню очереди (в нём и «Сохранить офлайн»)', () => {
    render(<QueuePanel onJump={() => {}} />);
    expect(screen.getAllByLabelText('Действия с очередью')).toHaveLength(1);
  });

  it('локальный файл меню не получает — скачивать в офлайн-кэш нечего', () => {
    usePlayerStore.setState({ queue: [LOCAL], track: LOCAL });
    render(<QueuePanel onJump={() => {}} />);
    expect(screen.queryByLabelText('Действия с очередью')).toBeNull();
  });
});
