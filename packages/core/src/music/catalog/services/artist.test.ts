import { describe, it, expect, vi } from 'vitest';
import { ArtistService } from './artist';
import { NotFoundError, ValidationError, ConflictError } from '../../../errors';
import type { IArtistRepository } from '../repositories/artist';
import type { IFileUploader } from '../../../platform/storage/repositories/storage';
import type { ArtistServiceDeps, IVideoTitleResolver, UpdateArtistProfileInput } from './artist';
import type { ArtistProfile } from '../types/artist';

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
    adminUpdate: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe('ArtistService.getBySlug', () => {
  it('returns ok(artist) when repo finds the artist', async () => {
    const repo = makeRepo({ findBySlug: vi.fn().mockResolvedValue(mockArtist) });
    const service = new ArtistService(repo, { now: () => 123 });

    const result = await service.getBySlug('test-artist');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(mockArtist);
    expect(repo.findBySlug).toHaveBeenCalledWith('test-artist');
  });

  it('returns err(NotFoundError) when repo returns null', async () => {
    const repo = makeRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const service = new ArtistService(repo, { now: () => 123 });

    const result = await service.getBySlug('unknown-slug');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.message).toContain('unknown-slug');
    }
  });

  it('calls repo.findBySlug with the exact slug', async () => {
    const repo = makeRepo({ findBySlug: vi.fn().mockResolvedValue(null) });
    const service = new ArtistService(repo, { now: () => 123 });

    await service.getBySlug('kotlaev');

    expect(repo.findBySlug).toHaveBeenCalledOnce();
    expect(repo.findBySlug).toHaveBeenCalledWith('kotlaev');
  });
});

function makeImageStorage(overrides?: Partial<IFileUploader>): IFileUploader {
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
    const service = new ArtistService(repo, { now: () => 123 });

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
    const service = new ArtistService(repo, { now: () => 123 });

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
    const service = new ArtistService(repo, { now: () => 123 });

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
    const service = new ArtistService(repo, { now: () => 123 });
    const file = { buffer: new Uint8Array([1]), ext: 'jpg', mime: 'image/jpeg' };

    await expect(service.updateProfile(mockArtist, { ...baseInput, avatar: file })).rejects.toThrow('deps.imageStorage');
  });

  it('keeps existing links/videos on malformed JSON', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123 });

    await service.updateProfile(mockArtist, { ...baseInput, linksRaw: 'not json', videosRaw: 'not json' });

    expect(repo.update).toHaveBeenCalledWith('artist-1', expect.objectContaining({
      links: mockArtist.links,
      videos: mockArtist.videos,
    }));
  });

  it('parses links: keeps valid entries, caps at 10, drops entries without a url', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123 });
    const links = Array.from({ length: 12 }, (_, i) => ({ url: `https://a.com/${i}` }));

    await service.updateProfile(mockArtist, { ...baseInput, linksRaw: JSON.stringify(links) });

    const call = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.links).toHaveLength(10);
  });

  it('resolves missing video titles via IVideoTitleResolver, skips already-titled videos', async () => {
    const repo = makeRepo();
    const resolver = makeVideoResolver();
    const service = new ArtistService(repo, { now: () => 123, videoTitleResolver: resolver });
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
    const service = new ArtistService(repo, { now: () => 123 });
    const videosRaw = JSON.stringify([{ url: 'https://youtube.com/2' }]);

    await expect(
      service.updateProfile(mockArtist, { ...baseInput, videosRaw }),
    ).rejects.toThrow('deps.videoTitleResolver');
  });

  it('validates hex colors, falling back to existing theme tokens on invalid input', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123 });

    await service.updateProfile(mockArtist, { ...baseInput, bg: '#ffffff', text: 'not-hex', accent: '#123abc' });

    const call = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.themeTokens).toMatchObject({ bg: '#ffffff', text: mockArtist.themeTokens.text, accent: '#123abc' });
  });

  it('picks fontSans/fontMono only when present in the injected catalog', async () => {
    const repo = makeRepo();
    const fonts = { sans: ['Inter', 'Rubik'], mono: ['JetBrains Mono'] };
    const service = new ArtistService(repo, { now: () => 123, fonts });

    await service.updateProfile(mockArtist, { ...baseInput, fontSans: 'Rubik', fontMono: 'Unknown Mono' });

    const call = (repo.update as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.themeTokens.fontSans).toBe('Rubik');
    expect(call.themeTokens.fontMono).toBe(mockArtist.themeTokens.fontMono);
  });

  it('throws when a font is given but the fonts catalog dependency is missing', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123 });

    await expect(
      service.updateProfile(mockArtist, { ...baseInput, fontSans: 'Inter' }),
    ).rejects.toThrow('deps.fonts');
  });
});

describe('ArtistService.adminUpdate', () => {
  const validInput = { name: 'New Name', slug: 'new-slug', bio: '  hi  ', avatarUrl: '  https://a.com  ' };

  it('trims/normalizes and calls repo.adminUpdate', async () => {
    const repo = makeRepo({ adminUpdate: vi.fn().mockResolvedValue({ ok: true }) });
    const service = new ArtistService(repo, { now: () => 123 });

    const result = await service.adminUpdate('artist-1', validInput);

    expect(result.ok).toBe(true);
    expect(repo.adminUpdate).toHaveBeenCalledWith('artist-1', {
      name: 'New Name',
      slug: 'new-slug',
      bio: 'hi',
      avatarUrl: 'https://a.com',
    });
  });

  it('lowercases the slug', async () => {
    const repo = makeRepo({ adminUpdate: vi.fn().mockResolvedValue({ ok: true }) });
    const service = new ArtistService(repo, { now: () => 123 });

    await service.adminUpdate('artist-1', { ...validInput, slug: 'NEW-SLUG' });

    expect(repo.adminUpdate).toHaveBeenCalledWith('artist-1', expect.objectContaining({ slug: 'new-slug' }));
  });

  it('returns err(ValidationError) when name is empty or exceeds 120 chars', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123 });

    const empty = await service.adminUpdate('artist-1', { ...validInput, name: '  ' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error).toBeInstanceOf(ValidationError);
      expect(empty.error.message).toBe('Имя: 1–120 символов');
    }

    const tooLong = await service.adminUpdate('artist-1', { ...validInput, name: 'x'.repeat(121) });
    expect(tooLong.ok).toBe(false);

    expect(repo.adminUpdate).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) for an invalid slug', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123 });

    const result = await service.adminUpdate('artist-1', { ...validInput, slug: 'a' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Slug: 2–60 символов, латиница/цифры/дефис');
    expect(repo.adminUpdate).not.toHaveBeenCalled();
  });

  it('returns err(ConflictError) with the repo error text when slug is taken', async () => {
    const repo = makeRepo({
      adminUpdate: vi.fn().mockResolvedValue({ ok: false, error: 'Slug already taken' }),
    });
    const service = new ArtistService(repo, { now: () => 123 });

    const result = await service.adminUpdate('artist-1', validInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
      expect(result.error.message).toBe('Slug already taken');
    }
  });

  it('normalizes empty bio/avatarUrl to null', async () => {
    const repo = makeRepo({ adminUpdate: vi.fn().mockResolvedValue({ ok: true }) });
    const service = new ArtistService(repo, { now: () => 123 });

    await service.adminUpdate('artist-1', { ...validInput, bio: '   ', avatarUrl: '   ' });

    expect(repo.adminUpdate).toHaveBeenCalledWith('artist-1', expect.objectContaining({ bio: null, avatarUrl: null }));
  });

  const validTheme = { bg: '#111111', text: '#eeeeee', accent: '#ff5c39', grain: true, fontSans: 'Inter', fontMono: 'JetBrains Mono' };
  const fonts = { sans: ['Inter', 'Rubik'], mono: ['JetBrains Mono'] };

  it('passes a valid theme through to repo.adminUpdate as themeTokens', async () => {
    const repo = makeRepo({ adminUpdate: vi.fn().mockResolvedValue({ ok: true }) });
    const service = new ArtistService(repo, { now: () => 123, fonts });

    const result = await service.adminUpdate('artist-1', { ...validInput, theme: validTheme });

    expect(result.ok).toBe(true);
    expect(repo.adminUpdate).toHaveBeenCalledWith('artist-1', expect.objectContaining({ themeTokens: validTheme }));
  });

  it('returns err(ValidationError) when a theme color is not a valid hex', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123, fonts });

    const result = await service.adminUpdate('artist-1', { ...validInput, theme: { ...validTheme, accent: 'not-hex' } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.adminUpdate).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) when a theme font is outside deps.fonts', async () => {
    const repo = makeRepo();
    const service = new ArtistService(repo, { now: () => 123, fonts });

    const result = await service.adminUpdate('artist-1', { ...validInput, theme: { ...validTheme, fontSans: 'Unknown Font' } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.adminUpdate).not.toHaveBeenCalled();
  });

  it('does not pass themeTokens to repo.adminUpdate when theme is not given', async () => {
    const repo = makeRepo({ adminUpdate: vi.fn().mockResolvedValue({ ok: true }) });
    const service = new ArtistService(repo, { now: () => 123, fonts });

    await service.adminUpdate('artist-1', validInput);

    const call = (repo.adminUpdate as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call).not.toHaveProperty('themeTokens');
  });
});
