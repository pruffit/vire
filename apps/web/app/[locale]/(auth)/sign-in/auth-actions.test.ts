import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByEmail, createWithPassword, hashFn, signIn } = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  createWithPassword: vi.fn(),
  hashFn: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock('next-auth', () => ({ AuthError: class extends Error {} }));
vi.mock('@/auth', () => ({ signIn }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleUserAccountRepository: class {
    findByEmail = findByEmail;
    createWithPassword = createWithPassword;
    getAuthInfo = vi.fn();
    setPasswordHash = vi.fn();
  },
}));
vi.mock('@/lib/password-hasher', () => ({
  BcryptPasswordHasher: class {
    hash = hashFn;
  },
}));

import { registerAction } from './auth-actions';

beforeEach(() => vi.clearAllMocks());

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const validFields = { name: 'Danya', email: 'a@b.com', password: 'password1', consent: 'on' };

describe('registerAction', () => {
  it('returns the taken-email message and does not create a user or sign in', async () => {
    findByEmail.mockResolvedValue({ id: 'existing' });

    const result = await registerAction(null, makeFormData(validFields));

    expect(result).toBe('Аккаунт с этим email уже существует. Войди вместо этого.');
    expect(createWithPassword).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('hashes the password, creates the user, then signs in', async () => {
    findByEmail.mockResolvedValue(null);
    hashFn.mockResolvedValue('hashed-pw');
    signIn.mockResolvedValue(undefined);

    const result = await registerAction(null, makeFormData(validFields));

    expect(result).toBeNull();
    expect(hashFn).toHaveBeenCalledWith('password1');
    expect(createWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Danya', passwordHash: 'hashed-pw' });
    expect(signIn).toHaveBeenCalledWith('credentials', { email: 'a@b.com', password: 'password1', redirectTo: '/' });
  });

  it('rejects invalid input at the edge without touching the db', async () => {
    const result = await registerAction(null, makeFormData({ ...validFields, email: 'not-an-email' }));

    expect(result).toBe('Введи корректный email.');
    expect(findByEmail).not.toHaveBeenCalled();
  });
});
