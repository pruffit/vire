import { describe, it, expect, vi } from 'vitest';
import { SmartLinkService, normalizeSlug, isValidSlug, parseSmartLinkLinks } from './smart-link';
import { NotFoundError, ValidationError, ConflictError } from '../../../errors';
import type { ISmartLinkRepository } from '../repositories/smart-link';
import type { IFileUploader } from '../../../platform/storage/repositories/storage';
import type { SmartLink } from '../../catalog/types/artist';

const mockLink: SmartLink = {
  id: 'link-1',
  artistProfileId: 'artist-1',
  slug: 'my-link',
  title: 'My Link',
  subtitle: null,
  coverUrl: null,
  releaseDate: null,
  releaseId: null,
  links: [],
  isPublished: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function makeRepo(overrides?: Partial<ISmartLinkRepository>): ISmartLinkRepository {
  return {
    slugTaken: vi.fn().mockResolvedValue(false),
    create: vi.fn().mockResolvedValue('link-1'),
    findById: vi.fn().mockResolvedValue(mockLink),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(true),
    releaseOwnedByArtist: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeStorage(overrides?: Partial<IFileUploader>): IFileUploader {
  return { upload: vi.fn().mockResolvedValue('https://cdn.example/covers/smartlinks/x.jpg'), ...overrides };
}

describe('normalizeSlug', () => {
  it('lowercases, collapses non-alphanumerics to dashes, trims edges, caps length', () => {
    expect(normalizeSlug('  My Cool Track!! ')).toBe('my-cool-track');
    expect(normalizeSlug('---x---')).toBe('x');
    expect(normalizeSlug('a'.repeat(100))).toHaveLength(60);
  });
});

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric-with-dashes', () => {
    expect(isValidSlug('my-track-1')).toBe(true);
  });

  it('rejects empty, uppercase, or invalid characters', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('My-Track')).toBe(false);
    expect(isValidSlug('a_b')).toBe(false);
  });
});

describe('parseSmartLinkLinks', () => {
  it('keeps only valid http(s) urls, trims labels, caps at max', () => {
    const raw = JSON.stringify([
      { url: 'https://a.com', label: '  Spotify  ' },
      { url: 'not-a-url' },
      { url: 'ftp://b.com' },
    ]);
    expect(parseSmartLinkLinks(raw)).toEqual([{ url: 'https://a.com', label: 'Spotify' }]);
  });

  it('returns [] for non-string, invalid JSON, or non-array input', () => {
    expect(parseSmartLinkLinks(undefined)).toEqual([]);
    expect(parseSmartLinkLinks('not json')).toEqual([]);
    expect(parseSmartLinkLinks('{}')).toEqual([]);
  });
});

const createInput = {
  title: 'My Release',
  slugRaw: null,
  subtitle: null,
  releaseDateRaw: null,
  releaseIdRaw: null,
  linksRaw: null,
  isPublished: false,
  cover: null,
};

describe('SmartLinkService.create', () => {
  it('creates with a slug derived from the title when slugRaw is absent', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.create('artist-1', createInput);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ id: 'link-1', slug: 'my-release' });
    expect(repo.create).toHaveBeenCalledWith('artist-1', expect.objectContaining({ slug: 'my-release', title: 'My Release' }));
  });

  it('returns err(ValidationError "Нужно название") when title is missing', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.create('artist-1', { ...createInput, title: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.code).toBe('smartLink.titleRequired');
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError "Некорректный адрес (slug)") for an invalid custom slug', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.create('artist-1', { ...createInput, slugRaw: '!!!' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('smartLink.invalidSlug');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns err(ConflictError "Такой адрес уже занят") when the slug is taken', async () => {
    const repo = makeRepo({ slugTaken: vi.fn().mockResolvedValue(true) });
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.create('artist-1', createInput);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ConflictError);
      expect(result.error.code).toBe('smartLink.slugTaken');
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError "Релиз не найден") when releaseId is not owned by the artist', async () => {
    const repo = makeRepo({ releaseOwnedByArtist: vi.fn().mockResolvedValue(false) });
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.create('artist-1', { ...createInput, releaseIdRaw: 'release-x' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('smartLink.releaseNotFound');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('uploads the cover under covers/smartlinks/{uuid}.{ext}', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const service = new SmartLinkService(repo, { coverStorage: storage, uuid: () => 'cover-id' });
    const cover = { buffer: new Uint8Array([1]), ext: 'jpg', mime: 'image/jpeg' };

    await service.create('artist-1', { ...createInput, cover });

    expect(storage.upload).toHaveBeenCalledWith('covers/smartlinks/cover-id.jpg', cover.buffer, 'image/jpeg');
  });

  it('throws when a cover is given but coverStorage dependency is missing', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });
    const cover = { buffer: new Uint8Array([1]), ext: 'jpg', mime: 'image/jpeg' };

    await expect(service.create('artist-1', { ...createInput, cover })).rejects.toThrow('deps.coverStorage');
  });
});

const updateInput = {
  title: undefined,
  slugRaw: undefined,
  subtitle: undefined,
  releaseDateRaw: undefined,
  releaseIdRaw: undefined,
  linksPresent: false,
  linksRaw: undefined,
  isPublishedRaw: undefined,
  cover: null,
  removeCover: false,
};

describe('SmartLinkService.update', () => {
  it('returns err(NotFoundError) when the link is missing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.update('missing', 'artist-1', updateInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns err(NotFoundError) when the link belongs to another artist (not Forbidden)', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.update('link-1', 'someone-else', updateInput);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('updates only the fields present in the input', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.update('link-1', 'artist-1', { ...updateInput, title: 'New Title' });

    expect(result.ok).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('link-1', 'artist-1', { title: 'New Title' });
  });

  it('checks slug uniqueness with excludeId when the slug changes', async () => {
    const repo = makeRepo({ slugTaken: vi.fn().mockResolvedValue(true) });
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.update('link-1', 'artist-1', { ...updateInput, slugRaw: 'new-slug' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(repo.slugTaken).toHaveBeenCalledWith('artist-1', 'new-slug', 'link-1');
  });

  it('does not check uniqueness when the slug is unchanged', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    await service.update('link-1', 'artist-1', { ...updateInput, slugRaw: mockLink.slug });

    expect(repo.slugTaken).not.toHaveBeenCalled();
  });

  it('clears releaseId when releaseIdRaw is present but blank', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    await service.update('link-1', 'artist-1', { ...updateInput, releaseIdRaw: '' });

    expect(repo.update).toHaveBeenCalledWith('link-1', 'artist-1', { releaseId: null });
  });

  it('returns err(ValidationError "Релиз не найден") when releaseId is not owned', async () => {
    const repo = makeRepo({ releaseOwnedByArtist: vi.fn().mockResolvedValue(false) });
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.update('link-1', 'artist-1', { ...updateInput, releaseIdRaw: 'release-x' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('smartLink.releaseNotFound');
  });

  it('clears the cover when removeCover is set and no new cover is given', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    await service.update('link-1', 'artist-1', { ...updateInput, removeCover: true });

    expect(repo.update).toHaveBeenCalledWith('link-1', 'artist-1', { coverUrl: null });
  });

  it('uploads a new cover, taking priority over removeCover', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const service = new SmartLinkService(repo, { coverStorage: storage, uuid: () => 'cover-id' });
    const cover = { buffer: new Uint8Array([1]), ext: 'png', mime: 'image/png' };

    await service.update('link-1', 'artist-1', { ...updateInput, cover, removeCover: true });

    expect(storage.upload).toHaveBeenCalledWith('covers/smartlinks/cover-id.png', cover.buffer, 'image/png');
    expect(repo.update).toHaveBeenCalledWith('link-1', 'artist-1', { coverUrl: 'https://cdn.example/covers/smartlinks/x.jpg' });
  });
});

describe('SmartLinkService.delete', () => {
  it('returns ok when repo deletes successfully', async () => {
    const repo = makeRepo();
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.delete('link-1', 'artist-1');

    expect(result.ok).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith('link-1', 'artist-1');
  });

  it('returns err(NotFoundError) when repo reports nothing was deleted', async () => {
    const repo = makeRepo({ delete: vi.fn().mockResolvedValue(false) });
    const service = new SmartLinkService(repo, { uuid: () => 'link-1' });

    const result = await service.delete('link-1', 'artist-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });
});
