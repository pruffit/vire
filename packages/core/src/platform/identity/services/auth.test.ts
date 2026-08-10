import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth';
import { ConflictError } from '../../../errors';
import type { IUserAccountRepository } from '../repositories/user-account';
import type { IPasswordHasher } from './auth';

function makeRepo(overrides?: Partial<IUserAccountRepository>): IUserAccountRepository {
  return {
    findByEmail: vi.fn().mockResolvedValue(null),
    createWithPassword: vi.fn().mockResolvedValue(undefined),
    getAuthInfo: vi.fn().mockResolvedValue({ hasPassword: false }),
    setPasswordHash: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeHasher(overrides?: Partial<IPasswordHasher>): IPasswordHasher {
  return { hash: vi.fn().mockResolvedValue('hashed'), ...overrides };
}

describe('AuthService.register', () => {
  it('returns err(ConflictError) when email is already taken', async () => {
    const repo = makeRepo({ findByEmail: vi.fn().mockResolvedValue({ id: 'u1' }) });
    const service = new AuthService(repo, { hasher: makeHasher() });

    const result = await service.register({ email: 'a@b.com', name: 'A', password: 'password1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(repo.createWithPassword).not.toHaveBeenCalled();
  });

  it('hashes the password and creates the user when email is free', async () => {
    const repo = makeRepo();
    const hasher = makeHasher({ hash: vi.fn().mockResolvedValue('hashed-pw') });
    const service = new AuthService(repo, { hasher });

    const result = await service.register({ email: 'a@b.com', name: 'A', password: 'password1' });

    expect(result.ok).toBe(true);
    expect(hasher.hash).toHaveBeenCalledWith('password1');
    expect(repo.createWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      name: 'A',
      passwordHash: 'hashed-pw',
    });
  });

  it('throws when hasher dependency is missing', async () => {
    const repo = makeRepo();
    const service = new AuthService(repo);

    await expect(
      service.register({ email: 'a@b.com', name: 'A', password: 'password1' }),
    ).rejects.toThrow('deps.hasher');
  });
});

describe('AuthService.setPassword', () => {
  it('returns err(ConflictError) when a password is already set', async () => {
    const repo = makeRepo({ getAuthInfo: vi.fn().mockResolvedValue({ hasPassword: true }) });
    const service = new AuthService(repo, { hasher: makeHasher() });

    const result = await service.setPassword('u1', 'password1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(repo.setPasswordHash).not.toHaveBeenCalled();
  });

  it('hashes the password and sets it when none is set yet', async () => {
    const repo = makeRepo({ getAuthInfo: vi.fn().mockResolvedValue({ hasPassword: false }) });
    const hasher = makeHasher({ hash: vi.fn().mockResolvedValue('hashed-pw') });
    const service = new AuthService(repo, { hasher });

    const result = await service.setPassword('u1', 'password1');

    expect(result.ok).toBe(true);
    expect(hasher.hash).toHaveBeenCalledWith('password1');
    expect(repo.setPasswordHash).toHaveBeenCalledWith('u1', 'hashed-pw');
  });

  it('throws when hasher dependency is missing', async () => {
    const repo = makeRepo();
    const service = new AuthService(repo);

    await expect(service.setPassword('u1', 'password1')).rejects.toThrow('deps.hasher');
  });
});
