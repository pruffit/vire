import { describe, it, expect, vi } from 'vitest';
import { PresaveService } from '../../services/presave';
import { NotFoundError, ValidationError } from '../../errors';
import type { IPresaveRepository } from '../../repositories/presave';

const RELEASE_ID = 'release-1';
const NOW = Date.parse('2026-01-01T00:00:00Z');

function makeRepo(overrides?: Partial<IPresaveRepository>): IPresaveRepository {
  return {
    getReleaseInfo: vi.fn().mockResolvedValue({
      id: RELEASE_ID,
      status: 'SCHEDULED',
      releaseDate: new Date(NOW + 86_400_000),
    }),
    presaveForUser: vi.fn().mockResolvedValue(undefined),
    unpresaveForUser: vi.fn().mockResolvedValue(undefined),
    presaveForGuest: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue(false),
    deletePendingGuestByEmail: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function service(repo: IPresaveRepository) {
  return new PresaveService(repo, { now: () => NOW });
}

describe('PresaveService.presaveUser', () => {
  it('returns NotFoundError when the release does not exist', async () => {
    const repo = makeRepo({ getReleaseInfo: vi.fn().mockResolvedValue(null) });
    const result = await service(repo).presaveUser('u1', RELEASE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.presaveForUser).not.toHaveBeenCalled();
  });

  it('returns ValidationError when the release is not SCHEDULED', async () => {
    const repo = makeRepo({
      getReleaseInfo: vi.fn().mockResolvedValue({ id: RELEASE_ID, status: 'PUBLISHED', releaseDate: new Date(NOW + 1000) }),
    });
    const result = await service(repo).presaveUser('u1', RELEASE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.code).toBe('presave.notPresavable');
    }
    expect(repo.presaveForUser).not.toHaveBeenCalled();
  });

  it('returns ValidationError when the release date is in the past (injected now)', async () => {
    const repo = makeRepo({
      getReleaseInfo: vi.fn().mockResolvedValue({ id: RELEASE_ID, status: 'SCHEDULED', releaseDate: new Date(NOW - 1000) }),
    });
    const result = await service(repo).presaveUser('u1', RELEASE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.presaveForUser).not.toHaveBeenCalled();
  });

  it('returns ValidationError when releaseDate is null', async () => {
    const repo = makeRepo({
      getReleaseInfo: vi.fn().mockResolvedValue({ id: RELEASE_ID, status: 'SCHEDULED', releaseDate: null }),
    });
    const result = await service(repo).presaveUser('u1', RELEASE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
  });

  it('presaves for a logged-in user when the release is presavable', async () => {
    const repo = makeRepo();
    const result = await service(repo).presaveUser('u1', RELEASE_ID);

    expect(result.ok).toBe(true);
    expect(repo.presaveForUser).toHaveBeenCalledWith('u1', RELEASE_ID);
  });
});

describe('PresaveService.presaveGuest', () => {
  it('presaves for a guest email when the release is presavable', async () => {
    const repo = makeRepo();
    const result = await service(repo).presaveGuest('fan@example.com', RELEASE_ID);

    expect(result.ok).toBe(true);
    expect(repo.presaveForGuest).toHaveBeenCalledWith('fan@example.com', RELEASE_ID);
  });

  it('returns NotFoundError when the release does not exist', async () => {
    const repo = makeRepo({ getReleaseInfo: vi.fn().mockResolvedValue(null) });
    const result = await service(repo).presaveGuest('fan@example.com', RELEASE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.presaveForGuest).not.toHaveBeenCalled();
  });
});

describe('PresaveService.getState', () => {
  it('returns the presaved flag from the repository', async () => {
    const repo = makeRepo({ getState: vi.fn().mockResolvedValue(true) });
    const result = await service(repo).getState('u1', RELEASE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ presaved: true });
  });
});

describe('PresaveService.unpresave', () => {
  it('delegates to the repository without checking existence', async () => {
    const repo = makeRepo();
    const result = await service(repo).unpresave('u1', RELEASE_ID);

    expect(result.ok).toBe(true);
    expect(repo.unpresaveForUser).toHaveBeenCalledWith('u1', RELEASE_ID);
  });
});

describe('PresaveService.unsubscribeGuest', () => {
  it('returns the deleted count from the repository', async () => {
    const repo = makeRepo({ deletePendingGuestByEmail: vi.fn().mockResolvedValue(3) });
    const result = await service(repo).unsubscribeGuest('fan@example.com');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ deleted: 3 });
    expect(repo.deletePendingGuestByEmail).toHaveBeenCalledWith('fan@example.com');
  });
});
