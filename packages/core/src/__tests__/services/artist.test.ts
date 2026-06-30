import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ArtistService } from '../../services/artist';
import { NotFoundError } from '../../errors';
import type { IArtistRepository } from '../../repositories/artist';
import type { ArtistProfile } from '../../types/artist';

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

function makeRepo(overrides?: Partial<IArtistRepository>): IArtistRepository {
  return {
    findBySlug: vi.fn(),
    findByUserId: vi.fn(),
    findAllByUserId: vi.fn(),
    findByIdForUser: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

describe('ArtistService.getBySlug', () => {
  it('returns ok(artist) when repo finds the artist', async () => {
    const repo = makeRepo({ findBySlug: vi.fn().mockResolvedValue(mockArtist) });
    const service = new ArtistService(repo);

    const result = await service.getBySlug('test-artist');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(mockArtist);
    expect(repo.findBySlug).toHaveBeenCalledWith('test-artist');
  });

  it('returns err(NotFoundError) when repo returns null', async () => {
    const repo = makeRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const service = new ArtistService(repo);

    const result = await service.getBySlug('unknown-slug');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.message).toContain('unknown-slug');
    }
  });

  it('calls repo.findBySlug with the exact slug', async () => {
    const repo = makeRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const service = new ArtistService(repo);

    await service.getBySlug('kotlaev');

    expect(repo.findBySlug).toHaveBeenCalledOnce();
    expect(repo.findBySlug).toHaveBeenCalledWith('kotlaev');
  });
});
