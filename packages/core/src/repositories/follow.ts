export interface IFollowRepository {
  follow(userId: string, artistProfileId: string): Promise<void>;
  unfollow(userId: string, artistProfileId: string): Promise<void>;
}
