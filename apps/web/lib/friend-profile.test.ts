import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserPublicProfile, getLikedTracks, getPublicPlaylistsByOwner, getStatus } = vi.hoisted(() => ({
  getUserPublicProfile: vi.fn(),
  getLikedTracks: vi.fn(),
  getPublicPlaylistsByOwner: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  getUserPublicProfile,
  getLikedTracks,
  getPublicPlaylistsByOwner,
}));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ getStatus }),
}));

import { loadFriendProfile } from './friend-profile';

const TARGET = 'user-target';
const VIEWER = 'user-viewer';
const PROFILE = { id: TARGET, name: 'Таргет', image: null, socialVisibility: 'FRIENDS' as const };
const LIKES = [{ id: 'like-1' }] as never;
const PLAYLISTS = [{ id: 'playlist-1' }] as never;

beforeEach(() => {
  vi.clearAllMocks();
  getPublicPlaylistsByOwner.mockResolvedValue(PLAYLISTS);
  getLikedTracks.mockResolvedValue(LIKES);
});

describe('loadFriendProfile', () => {
  it('профиль не найден → null', async () => {
    getUserPublicProfile.mockResolvedValue(null);
    const result = await loadFriendProfile(VIEWER, TARGET);
    expect(result).toBeNull();
  });

  it('гость на FRIENDS-профиле: лайки скрыты, плейлисты отданы', async () => {
    getUserPublicProfile.mockResolvedValue(PROFILE);
    const result = await loadFriendProfile(null, TARGET);
    expect(result?.likesVisible).toBe(false);
    expect(result?.likes).toEqual([]);
    expect(result?.playlists).toEqual(PLAYLISTS);
    expect(getLikedTracks).not.toHaveBeenCalled();
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('друг на FRIENDS-профиле: лайки видны, getLikedTracks вызван', async () => {
    getUserPublicProfile.mockResolvedValue(PROFILE);
    getStatus.mockResolvedValue('FRIENDS');
    const result = await loadFriendProfile(VIEWER, TARGET);
    expect(result?.status).toBe('FRIENDS');
    expect(result?.likesVisible).toBe(true);
    expect(result?.likes).toEqual(LIKES);
    expect(getLikedTracks).toHaveBeenCalledWith(TARGET);
  });

  it('друг на PRIVATE-профиле: лайки скрыты, getLikedTracks НЕ вызван', async () => {
    getUserPublicProfile.mockResolvedValue({ ...PROFILE, socialVisibility: 'PRIVATE' });
    getStatus.mockResolvedValue('FRIENDS');
    const result = await loadFriendProfile(VIEWER, TARGET);
    expect(result?.likesVisible).toBe(false);
    expect(result?.likes).toEqual([]);
    expect(getLikedTracks).not.toHaveBeenCalled();
  });

  it('сам пользователь: likesVisible=true', async () => {
    getUserPublicProfile.mockResolvedValue(PROFILE);
    getStatus.mockResolvedValue('SELF');
    const result = await loadFriendProfile(TARGET, TARGET);
    expect(result?.likesVisible).toBe(true);
  });
});
