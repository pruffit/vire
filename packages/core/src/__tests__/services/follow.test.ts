import { describe, it, expect, vi } from 'vitest';
import { FollowService } from '../../services/follow';
import { NotFoundError } from '../../errors';
import type { IArtistRepository } from '../../repositories/artist';
import type { IFollowRepository } from '../../repositories/follow';
import type { ArtistProfile } from '../../types/artist';

const mockArtist: ArtistProfile = {
  id: 'artist-1',
  userId: 'user-1',
  slug: 'test-artist',
  name: 'Test Artist',
  bio: null,
  avatarUrl: null,
  headerUrl: null,
  themeTokens: { bg: '#121110', text: '#f5f2eb', accent: '#4a5568', grain: true, fontSans: 'Inter', fontMono: 'JetBrains Mono' },
  links: [],
  videos: [],
  verified: false,
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function makeArtistRepo(overrides?: Partial<IArtistRepository>): IArtistRepository {
  return {
    findBySlug: vi.fn(),
    findByUserId: vi.fn(),
    findAllByUserId: vi.fn(),
    findByIdForUser: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function makeFollowRepo(overrides?: Partial<IFollowRepository>): IFollowRepository {
  return {
    follow: vi.fn().mockResolvedValue(undefined),
    unfollow: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('FollowService.follow', () => {
  it('follows when artist exists', async () => {
    const artistRepo = makeArtistRepo({ findBySlug: vi.fn().mockResolvedValue(mockArtist) });
    const followRepo = makeFollowRepo();
    const service = new FollowService(artistRepo, followRepo);

    const result = await service.follow('user-1', 'test-artist');

    expect(result.ok).toBe(true);
    expect(followRepo.follow).toHaveBeenCalledWith('user-1', 'artist-1');
  });

  it('returns err(NotFoundError) when artist does not exist', async () => {
    const artistRepo = makeArtistRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const followRepo = makeFollowRepo();
    const service = new FollowService(artistRepo, followRepo);

    const result = await service.follow('user-1', 'unknown-slug');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(followRepo.follow).not.toHaveBeenCalled();
  });
});

describe('FollowService.unfollow', () => {
  it('unfollows when artist exists', async () => {
    const artistRepo = makeArtistRepo({ findBySlug: vi.fn().mockResolvedValue(mockArtist) });
    const followRepo = makeFollowRepo();
    const service = new FollowService(artistRepo, followRepo);

    const result = await service.unfollow('user-1', 'test-artist');

    expect(result.ok).toBe(true);
    expect(followRepo.unfollow).toHaveBeenCalledWith('user-1', 'artist-1');
  });

  it('returns err(NotFoundError) when artist does not exist', async () => {
    const artistRepo = makeArtistRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const followRepo = makeFollowRepo();
    const service = new FollowService(artistRepo, followRepo);

    const result = await service.unfollow('user-1', 'unknown-slug');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(followRepo.unfollow).not.toHaveBeenCalled();
  });
});
