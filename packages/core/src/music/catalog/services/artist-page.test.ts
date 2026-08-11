import { describe, it, expect, vi } from 'vitest';
import { ArtistPageService } from './artist-page';
import { NotFoundError } from '../../../errors';
import type { IArtistReadRepository } from '../repositories/artist-read';
import type { ArtistProfile } from '../types/artist';
import type { ArtistUpcomingRelease } from '../types/artist-page';

const mockArtist: ArtistProfile = {
  id: 'artist-1',
  userId: 'user-1',
  slug: 'test-artist',
  name: 'Test Artist',
  bio: null,
  avatarUrl: null,
  headerUrl: null,
  themeTokens: {
    bg: '#121110',
    text: '#f5f2eb',
    accent: '#4a5568',
    grain: true,
    fontSans: 'Inter',
    fontMono: 'JetBrains Mono',
  },
  links: [],
  videos: [],
  verified: false,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function makeRepo(overrides?: Partial<IArtistReadRepository>): IArtistReadRepository {
  return {
    findBySlug: vi.fn().mockResolvedValue(mockArtist),
    hasPublishedTrack: vi.fn().mockResolvedValue(true),
    isMember: vi.fn().mockResolvedValue(false),
    listPublishedReleases: vi.fn().mockResolvedValue([]),
    listUpcoming: vi.fn().mockResolvedValue([]),
    listPosts: vi.fn().mockResolvedValue([]),
    listSmartLinks: vi.fn().mockResolvedValue([]),
    listPlayableTracks: vi.fn().mockResolvedValue([]),
    explicitReleaseIds: vi.fn().mockResolvedValue(new Set()),
    followerCount: vi.fn().mockResolvedValue(0),
    isFollowing: vi.fn().mockResolvedValue(false),
    presavedReleaseIds: vi.fn().mockResolvedValue(new Set()),
    ...overrides,
  };
}

describe('ArtistPageService.getPage — видимость', () => {
  it('returns err(NotFoundError) when the artist does not exist', async () => {
    const repo = makeRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'ghost', viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns err(NotFoundError) for an artist without published tracks when viewer is a guest', async () => {
    const repo = makeRepo({ hasPublishedTrack: vi.fn().mockResolvedValue(false) });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'test-artist', viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.isMember).not.toHaveBeenCalled();
  });

  it('returns the page for an artist without published tracks when viewer is a member', async () => {
    const repo = makeRepo({
      hasPublishedTrack: vi.fn().mockResolvedValue(false),
      isMember: vi.fn().mockResolvedValue(true),
    });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'test-artist', viewerId: 'user-1' });

    expect(result.ok).toBe(true);
    expect(repo.isMember).toHaveBeenCalledWith('artist-1', 'user-1');
  });

  it('returns the page for an artist with published tracks even for a guest', async () => {
    const repo = makeRepo({ hasPublishedTrack: vi.fn().mockResolvedValue(true) });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'test-artist', viewerId: null });

    expect(result.ok).toBe(true);
    expect(repo.isMember).not.toHaveBeenCalled();
  });
});

describe('ArtistPageService.getPage — персональные поля', () => {
  it('guest: following=false, presaved is empty, followerCount is still requested, isFollowing/presavedReleaseIds are not', async () => {
    const repo = makeRepo({ followerCount: vi.fn().mockResolvedValue(42) });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'test-artist', viewerId: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.following).toBe(false);
    expect(result.value.presavedReleaseIds).toEqual(new Set());
    expect(result.value.followerCount).toBe(42);
    expect(repo.followerCount).toHaveBeenCalledWith('artist-1');
    expect(repo.isFollowing).not.toHaveBeenCalled();
    expect(repo.presavedReleaseIds).not.toHaveBeenCalled();
  });

  it('signed-in viewer: following/presaved come from the repository', async () => {
    const repo = makeRepo({
      isFollowing: vi.fn().mockResolvedValue(true),
      presavedReleaseIds: vi.fn().mockResolvedValue(new Set(['release-1'])),
      listUpcoming: vi.fn().mockResolvedValue([
        { id: 'release-1', releaseDate: new Date('2030-01-01') } as ArtistUpcomingRelease,
      ]),
    });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'test-artist', viewerId: 'user-2' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.following).toBe(true);
    expect(result.value.presavedReleaseIds).toEqual(new Set(['release-1']));
    expect(repo.isFollowing).toHaveBeenCalledWith('user-2', 'artist-1');
  });

  it('presavedReleaseIds is queried only for upcoming releases that have a releaseDate', async () => {
    const repo = makeRepo({
      listUpcoming: vi.fn().mockResolvedValue([
        { id: 'release-dated', releaseDate: new Date('2030-01-01') } as ArtistUpcomingRelease,
        { id: 'release-undated', releaseDate: null } as ArtistUpcomingRelease,
      ]),
    });
    const service = new ArtistPageService(repo);

    await service.getPage({ slug: 'test-artist', viewerId: 'user-2' });

    expect(repo.presavedReleaseIds).toHaveBeenCalledWith('user-2', ['release-dated']);
  });
});

describe('ArtistPageService.getPage — состав ответа', () => {
  it('reads releases/upcoming/posts/smartLinks/playableTracks in parallel and merges explicit ids by release id', async () => {
    const repo = makeRepo({
      listPublishedReleases: vi.fn().mockResolvedValue([
        { id: 'release-1' } as never,
        { id: 'release-2' } as never,
      ]),
      explicitReleaseIds: vi.fn().mockResolvedValue(new Set(['release-2'])),
    });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'test-artist', viewerId: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(repo.explicitReleaseIds).toHaveBeenCalledWith(['release-1', 'release-2']);
    expect(result.value.explicitReleaseIds).toEqual(new Set(['release-2']));
    expect(result.value.releases).toHaveLength(2);
  });

  it('lists posts with a limit of 5', async () => {
    const repo = makeRepo();
    const service = new ArtistPageService(repo);

    await service.getPage({ slug: 'test-artist', viewerId: null });

    expect(repo.listPosts).toHaveBeenCalledWith('artist-1', 5);
  });
});

describe('ArtistPageService.getPage — staff-превью', () => {
  it('модератор видит пустого артиста, не будучи участником', async () => {
    const repo = makeRepo({ hasPublishedTrack: vi.fn().mockResolvedValue(false) });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'artist', viewerId: 'mod-1', viewerRole: 'MODERATOR' });

    expect(result.ok).toBe(true);
    expect(repo.isMember).not.toHaveBeenCalled();
  });

  it('слушателя роль не спасает — пустой артист скрыт', async () => {
    const repo = makeRepo({ hasPublishedTrack: vi.fn().mockResolvedValue(false) });
    const service = new ArtistPageService(repo);

    const result = await service.getPage({ slug: 'artist', viewerId: 'u-1', viewerRole: 'LISTENER' });

    expect(result.ok).toBe(false);
  });
});
