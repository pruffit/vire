import type { DB } from '../client';
import type { IUserAccountRepository } from '@vire/core';
import { findUserByEmail, createUserWithPassword, getUserAuthInfo, setUserPasswordHash } from '../queries/users';

export class DrizzleUserAccountRepository implements IUserAccountRepository {
  constructor(private readonly db: DB) {}

  async findByEmail(email: string): Promise<{ id: string } | null> {
    const user = await findUserByEmail(email);
    return user ? { id: user.id } : null;
  }

  async createWithPassword(input: { email: string; name: string; passwordHash: string }): Promise<void> {
    await createUserWithPassword(input);
  }

  async getAuthInfo(userId: string): Promise<{ hasPassword: boolean }> {
    const info = await getUserAuthInfo(userId);
    return { hasPassword: info.hasPassword };
  }

  setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    return setUserPasswordHash(userId, passwordHash);
  }
}
