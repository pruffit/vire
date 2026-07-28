// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const { replaceMock, refreshMock, toastErrorMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: replaceMock, refresh: refreshMock }) }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: toastErrorMock }) }));

import { PlaylistJoinBanner } from './playlist-join-banner';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('PlaylistJoinBanner', () => {
  it('анониму — ссылка на вход с callbackUrl на ту же ссылку-приглашение', () => {
    render(<PlaylistJoinBanner playlistId="p1" token="tok" inviterName="Даня" isAuthenticated={false} />);

    const link = screen.getByText('Войти').closest('a');
    expect(link?.getAttribute('href')).toBe(`/sign-in?callbackUrl=${encodeURIComponent('/playlists/p1?join=tok')}`);
  });

  it('авторизованный жмёт «Присоединиться» — POST с токеном, затем ре-навигация без ?join', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    render(<PlaylistJoinBanner playlistId="p1" token="tok" inviterName="Даня" isAuthenticated />);
    fireEvent.click(screen.getByText('Присоединиться'));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/playlists/p1'));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/playlists/p1/collaborators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok' }),
    });
    expect(refreshMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('сбой присоединения — тост об ошибке, без навигации', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) }));

    render(<PlaylistJoinBanner playlistId="p1" token="tok" inviterName="Даня" isAuthenticated />);
    fireEvent.click(screen.getByText('Присоединиться'));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled());
    expect(replaceMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
