import type { IUserDirectoryRepository, UserDirectoryHit } from '@vire/core';
import { searchUsersByName } from '../queries/user-directory';

export class DrizzleUserDirectoryRepository implements IUserDirectoryRepository {
  searchByName(query: string, limit: number, excludeId: string): Promise<UserDirectoryHit[]> {
    return searchUsersByName(query, limit, excludeId);
  }
}
