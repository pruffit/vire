import { describe, it, expect, vi } from 'vitest';
import { ArtistService } from '../../services/artist';
import { NotFoundError, ValidationError } from '../../errors';
import type { IArtistRepository } from '../../repositories/artist';
import type { IFileStorage } from '../../repositories/storage';
import type { ArtistServiceDeps, IVideoTitleResolver, UpdateArtistProfileInput } from '../../services/artist';
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

function makeImageStorage(overrides?: Partial<IFileStorage>): IFileStorage {
  return { upload: vi.fn().mockResolvedValue('https://cdn.example/avatars/artist-1.jpg'), ...overrides };
}

function makeVideoResolver(overrides?: Partial<IVideoTitleResolver>): IVideoTitleResolver {
  return { resolve: vi.fn().mockResolvedValue('Resolved Title'), ...overrides };
}

const baseInput: UpdateArtistProfileInput = {
  name: 'New Name',
  bio: null,
  avatar: null,
  removeAvatar: false,
  header: null,
  removeHeader: false,
  linksRaw: null,
  videosRaw: null,
  bg: null,
  text: null,
  accent: null,
  grain: true,
  fontSans: null,
  fontMono: null,
};

describe('ArtistService.updateProfile', () => {
  it('returns err(ValidationError) when name is missing or blank', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);

    const result = await service.updateProfile(mockArtist, { ...baseInput, name: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('Name is required');
    }
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('trims name/bio and falls back to existing avatar/header/theme when not given', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);

    const result = await service.updateProfile(mockArtist, { ...baseInput, name: '  New Name  ', bio: '  hi  ' });

    expect(result.ok).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('artist-1', expect.objectContaining({
      name: 'New Name',
      bio: 'hi',
      avatarUrl: mockArtist.avatarUrl,
      headerUrl: mockArtist.headerUrl,
      themeTokens: mockArtist.themeTokens,
    }));
  });

  it('clears avatar/header when remove flags are set', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);

    await service.updateProfile(
      { ...mockArtist, avatarUrl: 'https://old-avatar', headerUrl: 'https://old-header' },
      { ...baseInput, removeAvatar: true, removeHeader: true },
    );

    expect(repo.update).toHaveBeenCalledWith('artist-1', expect.objectContaining({ avatarUrl: null, headerUrl: null }));
  });

  it('uploads a new avatar/header and appends ?v=<now()>', async () => {
    const repo = makeRepo();
    const imageStorage = makeImageStorage();
    const deps: ArtistServiceDeps = { imageStorage, now: () => 123 };
    const service = new ArtistService(repo, deps);
    const file = { buffer: new Uint8Array([1]), ext: 'jpg', mime: 'image/jpeg' };

    await service.updateProfile(mockArtist, { ...baseInput, avatar: file, header: file });

    expect(imageStorage.upload).toHaveBeenCalledWith('avatars/artist-1.jpg', file.buffer, 'image/jpeg');
    expect(imageStorage.upload).toHaveBeenCalledWith('headers/artist-1.jpg', file.buffer, 'image/jpeg');
    expect(repo.update).toHaveBeenCalledWith('artist-1', expect.objectContaining({
      avatarUrl: 'https://cdn.example/avatars/artist-1.jpg?v=123',
      headerUrl: 'https://cdn.example/avatars/artist-1.jpg?v=123',
    }));
  });

  it('throws when a file is given but imageStorage dependency is missing', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);
    const file = { buffer: new Uint8Array([1]), ext: 'jpg', mime: 'image/jpeg' };

    await expect(service.updateProfile(mockArtist, { ...baseInput, avatar: file })).rejects.toThrow('deps.imageStorage');
  });

  it('keeps existing links/videos on malformed JSON', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);

    await service.updateProfile(mockArtist, { ...baseInput, linksRaw: 'not json', videosRaw: 'not json' });

    expect(repo.update).toHaveBeenCalledWith('artist-1', expect.objectContaining({
      links: mockArtist.links,
      videos: mockArtist.videos,
    }));
  });

  it('parses links: keeps valid entries, caps at 10, drops entries without a url', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);
    const links = Array.from({ length: 12 }, (_, i) => ({ url: `https://a.com/${i}` }));

    await service.updateProfile(mockArtist, { ...baseInput, linksRaw: JSON.stringify(links) });

    const call = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.links).toHaveLength(10);
  });

  it('resolves missing video titles via IVideoTitleResolver, skips already-titled videos', async () => {
    const repo = makeRepo();
    const resolver = makeVideoResolver();
    const service = new ArtistService(repo, { videoTitleResolver: resolver });
    const videosRaw = JSON.stringify([
      { url: 'https://youtube.com/1', title: 'Existing' },
      { url: 'https://youtube.com/2' },
    ]);

    await service.updateProfile(mockArtist, { ...baseInput, videosRaw });

    expect(resolver.resolve).toHaveBeenCalledTimes(1);
    expect(resolver.resolve).toHaveBeenCalledWith('https://youtube.com/2');
    const call = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.videos).toEqual([
      { url: 'https://youtube.com/1', title: 'Existing' },
      { url: 'https://youtube.com/2', title: 'Resolved Title' },
    ]);
  });

  it('throws when a video needs a title but videoTitleResolver dependency is missing', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);
    const videosRaw = JSON.stringify([{ url: 'https://youtube.com/2' }]);

    await expect(
      service.updateProfile(mockArtist, { ...baseInput, videosRaw }),
    ).rejects.toThrow('deps.videoTitleResolver');
  });

  it('validates hex colors, falling back to existing theme tokens on invalid input', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);

    await service.updateProfile(mockArtist, { ...baseInput, bg: '#ffffff', text: 'not-hex', accent: '#123abc' });

    const call = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.themeTokens).toMatchObject({ bg: '#ffffff', text: mockArtist.themeTokens.text, accent: '#123abc' });
  });

  it('picks fontSans/fontMono only when present in the injected catalog', async () => {
    const repo = makeRepo();
    const fonts = { sans: ['Inter', 'Rubik'], mono: ['JetBrains Mono'] };
    const service = new ArtistService(repo, { fonts });

    await service.updateProfile(mockArtist, { ...baseInput, fontSans: 'Rubik', fontMono: 'Unknown Mono' });

    const call = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.themeTokens.fontSans).toBe('Rubik');
    expect(call.themeTokens.fontMono).toBe(mockArtist.themeTokens.fontMono);
  });

  it('throws when a font is given but the fonts catalog dependency is missing', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo);

    await expect(
      service.updateProfile(mockArtist, { ...baseInput, fontSans: 'Inter' }),
    ).rejects.toThrow('deps.fonts');
  });
});
