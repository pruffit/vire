import { ok, type Result } from '../errors';
import type { IUserDirectoryRepository, UserDirectoryHit } from '../repositories/user-directory';

const MIN_QUERY_LENGTH = 2;

export class UserDirectoryService {
  constructor(private readonly repo: IUserDirectoryRepository) {}

  async search(q: string, viewerId: string, limit: number): Promise<Result<UserDirectoryHit[], never>> {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return ok([]);
    return ok(await this.repo.searchByName(trimmed, limit, viewerId));
  }
}
