import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getUserPublicProfile, getLikedTracks, getPublicPlaylistsByOwner, getStatus, isBlocked, isBlockedByMe } = vi.hoisted(() => ({
  getUserPublicProfile: vi.fn(),
  getLikedTracks: vi.fn(),
  getPublicPlaylistsByOwner: vi.fn(),
  getStatus: vi.fn(),
  isBlocked: vi.fn(),
  isBlockedByMe: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  getUserPublicProfile,
  getLikedTracks,
  getPublicPlaylistsByOwner,
}));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ getStatus }),
}));
vi.mock('@/lib/blocks', () => ({
  blockService: () => ({ isBlocked, isBlockedByMe }),
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
  isBlocked.mockResolvedValue(false);
  isBlockedByMe.mockResolvedValue(false);
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
    expect(result?.canChat).toBe(false);
    expect(getLikedTracks).not.toHaveBeenCalled();
    expect(getStatus).not.toHaveBeenCalled();
    expect(isBlocked).not.toHaveBeenCalled();
  });

  it('друг на FRIENDS-профиле: лайки видны, getLikedTracks вызван, чат доступен', async () => {
    getUserPublicProfile.mockResolvedValue(PROFILE);
    getStatus.mockResolvedValue('FRIENDS');
    const result = await loadFriendProfile(VIEWER, TARGET);
    expect(result?.status).toBe('FRIENDS');
    expect(result?.likesVisible).toBe(true);
    expect(result?.likes).toEqual(LIKES);
    expect(getLikedTracks).toHaveBeenCalledWith(TARGET);
    expect(result?.canChat).toBe(true);
  });

  it('друг, но блок (мой): чат/лайки скрыты, iBlockedThem=true', async () => {
    getUserPublicProfile.mockResolvedValue(PROFILE);
    getStatus.mockResolvedValue('FRIENDS');
    isBlocked.mockResolvedValue(true);
    isBlockedByMe.mockResolvedValue(true);
    const result = await loadFriendProfile(VIEWER, TARGET);
    expect(result?.canChat).toBe(false);
    expect(result?.likesVisible).toBe(false);
    expect(result?.blocked).toBe(true);
    expect(result?.iBlockedThem).toBe(true);
    expect(getLikedTracks).not.toHaveBeenCalled();
  });

  it('блок со стороны цели: blocked=true, iBlockedThem=false', async () => {
    getUserPublicProfile.mockResolvedValue(PROFILE);
    getStatus.mockResolvedValue('NONE');
    isBlocked.mockResolvedValue(true);
    isBlockedByMe.mockResolvedValue(false);
    const result = await loadFriendProfile(VIEWER, TARGET);
    expect(result?.blocked).toBe(true);
    expect(result?.iBlockedThem).toBe(false);
    expect(result?.canChat).toBe(false);
  });

  it('не друзья без блока: чат недоступен, лайки скрыты', async () => {
    getUserPublicProfile.mockResolvedValue(PROFILE);
    getStatus.mockResolvedValue('NONE');
    const result = await loadFriendProfile(VIEWER, TARGET);
    expect(result?.canChat).toBe(false);
    expect(result?.blocked).toBe(false);
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
