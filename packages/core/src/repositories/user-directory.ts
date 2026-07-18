export type UserDirectoryHit = { id: string; name: string; image: string | null };

export interface IUserDirectoryRepository {
  searchByName(query: string, limit: number, excludeId: string): Promise<UserDirectoryHit[]>;
}
