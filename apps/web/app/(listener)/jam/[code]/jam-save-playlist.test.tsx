// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { toast } from '@/lib/toast';
import { JamSavePlaylist } from './jam-save-playlist';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ playlistId: 'p1' }) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const click = () => fireEvent.click(screen.getByLabelText('Сохранить очередь в плейлист'));

describe('JamSavePlaylist', () => {
  it('пустая очередь: объясняет и не ходит в сеть', () => {
    render(<JamSavePlaylist code="ABC123" savableCount={0} queueLength={0} />);
    click();
    expect(toast.error).toHaveBeenCalledWith('Очередь пуста — добавьте треки');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('только внешние треки: объясняет, что сохраняются лишь треки каталога', () => {
    render(<JamSavePlaylist code="ABC123" savableCount={0} queueLength={3} />);
    click();
    expect(toast.error).toHaveBeenCalledWith('В плейлист идут только треки каталога VireMusic');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('есть треки каталога: сохраняет и показывает ссылку на плейлист', async () => {
    render(<JamSavePlaylist code="ABC123" savableCount={2} queueLength={3} />);
    click();
    await vi.waitFor(() => expect(screen.getByRole('link')).toHaveProperty('href', expect.stringContaining('/playlists/p1')));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/jam/ABC123/save-playlist', { method: 'POST' });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('ошибка сервера показывается пользователю', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Очередь пуста' }) });
    render(<JamSavePlaylist code="ABC123" savableCount={2} queueLength={3} />);
    click();
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Очередь пуста'));
  });
});
