import { describe, it, expect, vi } from 'vitest';
import { ArtistPostService, normalizePostInput } from '../../services/artist-post';
import { NotFoundError, ValidationError } from '../../errors';
import type { IArtistPostRepository } from '../../repositories/artist-post';
import type { ArtistPost } from '../../types/artist-post';

const mockPost: ArtistPost = {
  id: 'post-1',
  artistProfileId: 'artist-1',
  title: 'News',
  body: 'Hello',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

function makeRepo(overrides?: Partial<IArtistPostRepository>): IArtistPostRepository {
  return {
    create: vi.fn().mockResolvedValue(mockPost),
    findById: vi.fn().mockResolvedValue(mockPost),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('normalizePostInput', () => {
  it('trims title and body, empty title becomes null', () => {
    expect(normalizePostInput({ title: '  Hi  ', body: '  text  ' })).toEqual({ title: 'Hi', body: 'text' });
    expect(normalizePostInput({ title: '   ', body: 'x' })).toEqual({ title: null, body: 'x' });
  });

  it('defaults body to empty string for non-string / missing fields', () => {
    expect(normalizePostInput({})).toEqual({ title: null, body: '' });
    expect(normalizePostInput(null)).toEqual({ title: null, body: '' });
    expect(normalizePostInput({ body: 42 })).toEqual({ title: null, body: '' });
  });
});

describe('ArtistPostService.create', () => {
  it('creates a post when body is non-empty', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.create('artist-1', { title: 'News', body: 'Hello' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ post: mockPost });
    expect(repo.create).toHaveBeenCalledWith({ artistProfileId: 'artist-1', title: 'News', body: 'Hello' });
  });

  it('returns err(ValidationError "Body is required") when body is empty', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.create('artist-1', { body: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('Body is required');
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError "Too long") when body exceeds 2000 chars', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.create('artist-1', { body: 'x'.repeat(2001) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Too long');
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError "Too long") when title exceeds 120 chars', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.create('artist-1', { title: 'x'.repeat(121), body: 'ok' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('Too long');
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe('ArtistPostService.update', () => {
  it('updates when post belongs to artist', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.update('post-1', 'artist-1', { title: 'New', body: 'text' });

    expect(result.ok).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('post-1', { title: 'New', body: 'text' });
  });

  it('returns err(NotFoundError) when post is missing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new ArtistPostService(repo);

    const result = await service.update('missing', 'artist-1', { body: 'x' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when post belongs to another artist', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.update('post-1', 'someone-else', { body: 'x' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns err(ValidationError) when body is empty', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.update('post-1', 'artist-1', { body: '  ' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('ArtistPostService.delete', () => {
  it('deletes when post belongs to artist', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.delete('post-1', 'artist-1');

    expect(result.ok).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith('post-1');
  });

  it('returns err(NotFoundError) when post is missing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new ArtistPostService(repo);

    const result = await service.delete('missing', 'artist-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns err(Forbidden) when post belongs to another artist', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.delete('post-1', 'someone-else');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('Forbidden');
    expect(repo.delete).not.toHaveBeenCalled();
  });
});

describe('ArtistPostService.adminUpdate', () => {
  it('updates without an ownership check', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.adminUpdate('post-1', { title: 'New', body: 'text' });

    expect(result.ok).toBe(true);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith('post-1', { title: 'New', body: 'text' });
  });

  it('trims and caps title at 200 chars, defaults empty title to null', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    await service.adminUpdate('post-1', { title: '  ' + 'x'.repeat(210), body: 'text' });

    expect(repo.update).toHaveBeenCalledWith('post-1', { title: 'x'.repeat(200), body: 'text' });

    await service.adminUpdate('post-1', { title: '   ', body: 'text' });
    expect(repo.update).toHaveBeenCalledWith('post-1', { title: null, body: 'text' });
  });

  it('returns err(ValidationError) when body is empty or exceeds 10000 chars', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const empty = await service.adminUpdate('post-1', { title: null, body: '   ' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.error).toBeInstanceOf(ValidationError);
      expect(empty.error.code).toBe('artistPost.textLength');
    }

    const tooLong = await service.adminUpdate('post-1', { title: null, body: 'x'.repeat(10001) });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.error.code).toBe('artistPost.textLength');

    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('ArtistPostService.adminDelete', () => {
  it('deletes without an ownership check', async () => {
    const repo = makeRepo();
    const service = new ArtistPostService(repo);

    const result = await service.adminDelete('post-1');

    expect(result.ok).toBe(true);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.delete).toHaveBeenCalledWith('post-1');
  });
});
