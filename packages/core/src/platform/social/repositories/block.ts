export interface IBlockRepository {
  block(blockerId: string, blockedId: string): Promise<void>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  existsEitherWay(a: string, b: string): Promise<boolean>;
  existsDirected(blockerId: string, blockedId: string): Promise<boolean>;
  listBlocked(userId: string): Promise<string[]>;
}
