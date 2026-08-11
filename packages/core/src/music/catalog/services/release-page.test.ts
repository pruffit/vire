import { describe, it, expect, vi } from 'vitest';
import { ReleasePageService } from './release-page';
import { NotFoundError } from '../../../errors';
import type { IReleaseReadRepository } from '../repositories/release-read';
import type { ArtistProfile } from '../types/artist';
import type { Release, ReleaseWithTracks, Track } from '../types/release';

const NOW = new Date('2026-01-01T00:00:00Z').getTime();
const clock = () => NOW;

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

const mockTrack: Track = {
  id: 'track-1',
  releaseId: 'release-1',
  title: 'Track One',
  version: null,
  trackNumber: 1,
  durationSec: 180,
  status: 'READY',
  isExclusive: false,
  isWip: false,
  isExplicit: false,
  credits: [],
  lyrics: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function mockRelease(overrides?: Partial<Release>): Release {
  return {
    id: 'release-1',
    artistProfileId: 'artist-1',
    title: 'Test Release',
    type: 'ALBUM',
    genre: null,
    coverUrl: null,
    releaseDate: null,
    status: 'PUBLISHED',
    description: null,
    linerNotes: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function mockFound(overrides?: Partial<Release>): ReleaseWithTracks {
  return { release: mockRelease(overrides), tracks: [mockTrack] };
}

function makeRepo(overrides?: Partial<IReleaseReadRepository>): IReleaseReadRepository {
  return {
    findArtistBySlug: vi.fn().mockResolvedValue(mockArtist),
    findArtistById: vi.fn().mockResolvedValue(mockArtist),
    findReleaseWithTracks: vi.fn().mockResolvedValue(mockFound()),
    isPresaved: vi.fn().mockResolvedValue(false),
    hasPublishedTrack: vi.fn().mockResolvedValue(true),
    isMember: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('ReleasePageService.getPage — видимость', () => {
  it('returns err(NotFoundError) when the release does not exist', async () => {
    const repo = makeRepo({ findReleaseWithTracks: vi.fn().mockResolvedValue(null) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'ghost', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.code).toBe('release.notFound');
    }
  });

  it('returns err(NotFoundError) when the artist does not exist', async () => {
    const repo = makeRepo({ findArtistBySlug: vi.fn().mockResolvedValue(null) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: 'test-artist', viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.code).toBe('release.notFound');
    }
  });

  it('returns err(NotFoundError) when the release belongs to a different artist than the slug', async () => {
    const repo = makeRepo({
      findArtistBySlug: vi.fn().mockResolvedValue({ ...mockArtist, id: 'artist-2' }),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: 'other-artist', viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.code).toBe('release.notFound');
    }
  });

  it('returns err(NotFoundError) for DRAFT', async () => {
    const repo = makeRepo({ findReleaseWithTracks: vi.fn().mockResolvedValue(mockFound({ status: 'DRAFT' })) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('release.notFound');
  });

  it('returns err(NotFoundError) for ARCHIVED', async () => {
    const repo = makeRepo({ findReleaseWithTracks: vi.fn().mockResolvedValue(mockFound({ status: 'ARCHIVED' })) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('release.notFound');
  });

  it('returns err(NotFoundError) for SCHEDULED without a release date', async () => {
    const repo = makeRepo({
      findReleaseWithTracks: vi.fn().mockResolvedValue(mockFound({ status: 'SCHEDULED', releaseDate: null })),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('release.notFound');
  });
});

describe('ReleasePageService.getPage — пустой артист (без опубликованных треков)', () => {
  it('returns err(NotFoundError) for a guest', async () => {
    const repo = makeRepo({ hasPublishedTrack: vi.fn().mockResolvedValue(false) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.code).toBe('release.notFound');
    }
    expect(repo.isMember).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) for a signed-in stranger', async () => {
    const repo = makeRepo({ hasPublishedTrack: vi.fn().mockResolvedValue(false) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: 'user-2' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('release.notFound');
    expect(repo.isMember).toHaveBeenCalledWith('artist-1', 'user-2');
  });

  it('returns the page for a member', async () => {
    const repo = makeRepo({
      hasPublishedTrack: vi.fn().mockResolvedValue(false),
      isMember: vi.fn().mockResolvedValue(true),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: 'user-1' });

    expect(result.ok).toBe(true);
    expect(repo.isMember).toHaveBeenCalledWith('artist-1', 'user-1');
  });

  it('returns the page for staff (staff.content.preview), isMember not called', async () => {
    const repo = makeRepo({ hasPublishedTrack: vi.fn().mockResolvedValue(false) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({
      releaseId: 'release-1',
      artistSlug: null,
      viewerId: 'mod-1',
      viewerRole: 'MODERATOR',
    });

    expect(result.ok).toBe(true);
    expect(repo.isMember).not.toHaveBeenCalled();
  });
});

describe('ReleasePageService.getPage — вышедший релиз', () => {
  it('PUBLISHED: isReleased=true, tracks present', async () => {
    const repo = makeRepo({ findReleaseWithTracks: vi.fn().mockResolvedValue(mockFound({ status: 'PUBLISHED' })) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isReleased).toBe(true);
    expect(result.value.showCountdown).toBe(false);
    expect(result.value.tracks).toHaveLength(1);
  });

  it('PUBLISHED: linerNotes is passed through untouched', async () => {
    const repo = makeRepo({
      findReleaseWithTracks: vi.fn().mockResolvedValue(
        mockFound({ status: 'PUBLISHED', linerNotes: 'Written in a basement.' }),
      ),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.release.linerNotes).toBe('Written in a basement.');
  });

  it('SCHEDULED with a past release date: isReleased=true, tracks present', async () => {
    const repo = makeRepo({
      findReleaseWithTracks: vi.fn().mockResolvedValue(
        mockFound({ status: 'SCHEDULED', releaseDate: new Date(NOW - 1000) }),
      ),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isReleased).toBe(true);
    expect(result.value.tracks).toHaveLength(1);
  });

  it('isPresaved is not called for a released release even for a signed-in viewer', async () => {
    const repo = makeRepo({ findReleaseWithTracks: vi.fn().mockResolvedValue(mockFound({ status: 'PUBLISHED' })) });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: 'user-2' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.presaved).toBe(false);
    expect(repo.isPresaved).not.toHaveBeenCalled();
  });
});

describe('ReleasePageService.getPage — отсчёт', () => {
  it('SCHEDULED with a future release date: showCountdown=true, tracks=[], linerNotes=null', async () => {
    const repo = makeRepo({
      findReleaseWithTracks: vi.fn().mockResolvedValue(
        mockFound({ status: 'SCHEDULED', releaseDate: new Date(NOW + 1000), linerNotes: 'Spoilers ahead.' }),
      ),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isReleased).toBe(false);
    expect(result.value.showCountdown).toBe(true);
    expect(result.value.tracks).toEqual([]);
    expect(result.value.release.linerNotes).toBeNull();
  });

  it('presaved=true for a signed-in viewer, isPresaved called with viewerId/releaseId', async () => {
    const repo = makeRepo({
      findReleaseWithTracks: vi.fn().mockResolvedValue(
        mockFound({ status: 'SCHEDULED', releaseDate: new Date(NOW + 1000) }),
      ),
      isPresaved: vi.fn().mockResolvedValue(true),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: 'user-2' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.presaved).toBe(true);
    expect(repo.isPresaved).toHaveBeenCalledWith('user-2', 'release-1');
  });

  it('isPresaved is not called for a guest in countdown mode', async () => {
    const repo = makeRepo({
      findReleaseWithTracks: vi.fn().mockResolvedValue(
        mockFound({ status: 'SCHEDULED', releaseDate: new Date(NOW + 1000) }),
      ),
    });
    const service = new ReleasePageService(repo, clock);

    const result = await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.presaved).toBe(false);
    expect(repo.isPresaved).not.toHaveBeenCalled();
  });
});

describe('ReleasePageService.getPage — резолв артиста', () => {
  it('resolves the artist via findArtistById when artistSlug is not given', async () => {
    const repo = makeRepo();
    const service = new ReleasePageService(repo, clock);

    await service.getPage({ releaseId: 'release-1', artistSlug: null, viewerId: null });

    expect(repo.findArtistById).toHaveBeenCalledWith('artist-1');
    expect(repo.findArtistBySlug).not.toHaveBeenCalled();
  });

  it('resolves the artist via findArtistBySlug when artistSlug is given', async () => {
    const repo = makeRepo();
    const service = new ReleasePageService(repo, clock);

    await service.getPage({ releaseId: 'release-1', artistSlug: 'test-artist', viewerId: null });

    expect(repo.findArtistBySlug).toHaveBeenCalledWith('test-artist');
    expect(repo.findArtistById).not.toHaveBeenCalled();
  });
});
