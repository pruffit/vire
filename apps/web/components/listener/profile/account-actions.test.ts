import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTranslator } from '@vire/i18n/translator';

const t = await getTranslator('ru', 'auth.errors');

const { auth, getAuthInfo, setPasswordHash, hashFn } = vi.hoisted(() => ({
  auth: vi.fn(),
  getAuthInfo: vi.fn(),
  setPasswordHash: vi.fn(),
  hashFn: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth, signIn: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleUserAccountRepository: class {
    findByEmail = vi.fn();
    createWithPassword = vi.fn();
    getAuthInfo = getAuthInfo;
    setPasswordHash = setPasswordHash;
  },
}));
vi.mock('@/lib/password-hasher', () => ({
  BcryptPasswordHasher: class {
    hash = hashFn;
  },
}));

import { setPasswordAction } from './account-actions';

beforeEach(() => vi.clearAllMocks());

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe('setPasswordAction', () => {
  it('returns an error when not signed in', async () => {
    auth.mockResolvedValue(null);

    const result = await setPasswordAction(null, makeFormData({ password: 'password1', confirmPassword: 'password1' }));

    expect(result).toBe(t('signInRequired'));
    expect(getAuthInfo).not.toHaveBeenCalled();
  });

  it('returns an error when a password is already set, without touching setPasswordHash', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    getAuthInfo.mockResolvedValue({ hasPassword: true });

    const result = await setPasswordAction(null, makeFormData({ password: 'password1', confirmPassword: 'password1' }));

    expect(result).toBe(t('passwordAlreadySet'));
    expect(setPasswordHash).not.toHaveBeenCalled();
  });

  it('hashes and sets the password on success', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });
    getAuthInfo.mockResolvedValue({ hasPassword: false });
    hashFn.mockResolvedValue('hashed-pw');

    const result = await setPasswordAction(null, makeFormData({ password: 'password1', confirmPassword: 'password1' }));

    expect(result).toBe('ok');
    expect(hashFn).toHaveBeenCalledWith('password1');
    expect(setPasswordHash).toHaveBeenCalledWith('u1', 'hashed-pw');
  });

  it('returns an error when passwords do not match, without checking auth info', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } });

    const result = await setPasswordAction(null, makeFormData({ password: 'password1', confirmPassword: 'password2' }));

    expect(result).toBe(t('passwordMismatch'));
    expect(getAuthInfo).not.toHaveBeenCalled();
  });
});
