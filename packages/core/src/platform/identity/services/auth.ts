import { err, ok, ConflictError, type Result } from '../../../errors';
import type { IUserAccountRepository } from '../repositories/user-account';

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
}

export interface AuthServiceDeps {
  hasher?: IPasswordHasher;
}

export class AuthService {
  constructor(
    private readonly repo: IUserAccountRepository,
    private readonly deps: AuthServiceDeps = {},
  ) {}

  async register(input: { email: string; name: string; password: string }): Promise<Result<void, ConflictError>> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) return err(new ConflictError('User', input.email, 'auth.emailTaken'));

    const passwordHash = await this.hash(input.password);
    await this.repo.createWithPassword({ email: input.email, name: input.name, passwordHash });
    return ok(undefined);
  }

  async setPassword(userId: string, password: string): Promise<Result<void, ConflictError>> {
    const info = await this.repo.getAuthInfo(userId);
    if (info.hasPassword) return err(new ConflictError('Password', userId, 'auth.passwordAlreadySet'));

    const passwordHash = await this.hash(password);
    await this.repo.setPasswordHash(userId, passwordHash);
    return ok(undefined);
  }

  private hash(plain: string): Promise<string> {
    if (!this.deps.hasher) throw new Error('AuthService: deps.hasher is required to hash a password');
    return this.deps.hasher.hash(plain);
  }
}
