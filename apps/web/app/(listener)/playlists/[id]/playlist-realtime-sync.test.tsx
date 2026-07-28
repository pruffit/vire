// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const { useRealtimeMock } = vi.hoisted(() => ({ useRealtimeMock: vi.fn() }));

vi.mock('@/lib/use-realtime', () => ({ useRealtime: useRealtimeMock }));

import { PlaylistRealtimeSync } from './playlist-realtime-sync';

function lastHandlers() {
  const call = useRealtimeMock.mock.calls.at(-1) as [string, Record<string, (e: Record<string, unknown>) => void>];
  return call[1];
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('PlaylistRealtimeSync', () => {
  it('подписывается на стрим конкретного плейлиста', () => {
    render(
      <PlaylistRealtimeSync
        playlistId="p1"
        selfUserId="u1"
        version={3}
        onTracksChanged={vi.fn()}
        onCollaboratorsChanged={vi.fn()}
      />,
    );

    expect(useRealtimeMock).toHaveBeenCalledWith('/api/v1/playlists/p1/stream', expect.any(Object));
  });

  it('игнорирует playlist:changed со своим actorId — правка уже применена оптимистично', () => {
    const onTracksChanged = vi.fn();
    render(
      <PlaylistRealtimeSync playlistId="p1" selfUserId="u1" version={3} onTracksChanged={onTracksChanged} onCollaboratorsChanged={vi.fn()} />,
    );

    lastHandlers()['playlist:changed']!({ playlistId: 'p1', version: 4, actorId: 'u1' });

    expect(onTracksChanged).not.toHaveBeenCalled();
  });

  it('отбрасывает playlist:changed с версией не новее текущей', () => {
    const onTracksChanged = vi.fn();
    render(
      <PlaylistRealtimeSync playlistId="p1" selfUserId="u1" version={5} onTracksChanged={onTracksChanged} onCollaboratorsChanged={vi.fn()} />,
    );

    lastHandlers()['playlist:changed']!({ playlistId: 'p1', version: 5, actorId: 'other' });

    expect(onTracksChanged).not.toHaveBeenCalled();
  });

  it('перечитывает состав на playlist:changed от другого участника с более новой версией', () => {
    const onTracksChanged = vi.fn();
    render(
      <PlaylistRealtimeSync playlistId="p1" selfUserId="u1" version={5} onTracksChanged={onTracksChanged} onCollaboratorsChanged={vi.fn()} />,
    );

    lastHandlers()['playlist:changed']!({ playlistId: 'p1', version: 6, actorId: 'other' });

    expect(onTracksChanged).toHaveBeenCalledWith(6);
  });

  it('применяет снапшот с версией новее текущей (например, после реконнекта)', () => {
    const onTracksChanged = vi.fn();
    render(
      <PlaylistRealtimeSync playlistId="p1" selfUserId="u1" version={2} onTracksChanged={onTracksChanged} onCollaboratorsChanged={vi.fn()} />,
    );

    lastHandlers()['playlist:snapshot']!({ playlistId: 'p1', version: 5 });

    expect(onTracksChanged).toHaveBeenCalledWith(5);
  });

  it('игнорирует playlist:collaborators со своим actorId', () => {
    const onCollaboratorsChanged = vi.fn();
    render(
      <PlaylistRealtimeSync playlistId="p1" selfUserId="u1" version={3} onTracksChanged={vi.fn()} onCollaboratorsChanged={onCollaboratorsChanged} />,
    );

    lastHandlers()['playlist:collaborators']!({ playlistId: 'p1', actorId: 'u1' });

    expect(onCollaboratorsChanged).not.toHaveBeenCalled();
  });

  it('реагирует на playlist:collaborators от другого участника', () => {
    const onCollaboratorsChanged = vi.fn();
    render(
      <PlaylistRealtimeSync playlistId="p1" selfUserId="u1" version={3} onTracksChanged={vi.fn()} onCollaboratorsChanged={onCollaboratorsChanged} />,
    );

    lastHandlers()['playlist:collaborators']!({ playlistId: 'p1', actorId: 'other' });

    expect(onCollaboratorsChanged).toHaveBeenCalled();
  });
});
