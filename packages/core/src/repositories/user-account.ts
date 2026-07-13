export interface IUserAccountRepository {
  findByEmail(email: string): Promise<{ id: string } | null>;
  createWithPassword(input: { email: string; name: string; passwordHash: string }): Promise<void>;
  getAuthInfo(userId: string): Promise<{ hasPassword: boolean }>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
}
