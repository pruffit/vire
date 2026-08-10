// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { PlaylistWithTracks, PlaylistTrack } from '@vire/core';

const { playQueueMock, toggleMock } = vi.hoisted(() => ({
  playQueueMock: vi.fn(),
  toggleMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('@/lib/player/audio-engine', () => ({ controls: { playQueue: playQueueMock, toggle: toggleMock } }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('./playlist-realtime-sync', () => ({
  PlaylistRealtimeSync: (props: { selfUserId: string }) => <div data-testid="realtime-sync" data-self={props.selfUserId} />,
}));

import { PlaylistView } from './playlist-view';

function track(id: string, addedById: string | null): PlaylistTrack {
  return {
    id,
    title: `Track ${id}`,
    durationSec: 180,
    position: 0,
    artistName: 'Artist',
    artistSlug: 'artist',
    releaseId: 'r1',
    coverUrl: null,
    accentColor: null,
    isExplicit: false,
    version: null,
    feat: [],
    addedBy: addedById ? { id: addedById, name: 'Кто-то', image: null } : null,
  };
}

function playlist(overrides?: Partial<PlaylistWithTracks>): PlaylistWithTracks {
  return {
    id: 'p1',
    title: 'Плейлист',
    description: null,
    coverUrl: null,
    kind: 'USER',
    editorialParams: null,
    visibility: 'PRIVATE',
    ownerUserId: 'owner-1',
    likesCount: 0,
    isCollaborative: false,
    version: 0,
    tracks: [track('t1', 'owner-1')],
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('PlaylistView — права по роли', () => {
  it('VIEWER не видит ни «Добавить треки», ни удаление', () => {
    render(<PlaylistView playlist={playlist()} role="VIEWER" viewerId={null} />);

    expect(screen.queryByText('Добавить треки')).toBeNull();
    expect(screen.queryByLabelText('Удалить из плейлиста')).toBeNull();
  });

  it('OWNER видит «Добавить треки» и удаление любого трека', () => {
    render(
      <PlaylistView
        playlist={playlist({ tracks: [track('t1', 'owner-1'), track('t2', 'collab-1')] })}
        role="OWNER"
        viewerId="owner-1"
      />,
    );

    expect(screen.getByText('Добавить треки')).toBeTruthy();
    expect(screen.getAllByLabelText('Удалить из плейлиста')).toHaveLength(2);
  });

  it('COLLABORATOR может добавлять, но удаляет только свои треки', () => {
    render(
      <PlaylistView
        playlist={playlist({
          isCollaborative: true,
          tracks: [track('t1', 'owner-1'), track('t2', 'collab-1')],
        })}
        role="COLLABORATOR"
        viewerId="collab-1"
      />,
    );

    expect(screen.getByText('Добавить треки')).toBeTruthy();
    // только свой трек (t2) можно удалить — один remove-контрол на весь список
    expect(screen.getAllByLabelText('Удалить из плейлиста')).toHaveLength(1);
  });

  it('SSE-синхронизация подключается только для участника совместного плейлиста', () => {
    const { rerender } = render(
      <PlaylistView playlist={playlist({ isCollaborative: false })} role="OWNER" viewerId="owner-1" />,
    );
    expect(screen.queryByTestId('realtime-sync')).toBeNull();

    rerender(<PlaylistView playlist={playlist({ isCollaborative: true })} role="OWNER" viewerId="owner-1" />);
    expect(screen.getByTestId('realtime-sync')).toBeTruthy();

    rerender(<PlaylistView playlist={playlist({ isCollaborative: true })} role="VIEWER" viewerId="stranger" />);
    expect(screen.queryByTestId('realtime-sync')).toBeNull();
  });
});
