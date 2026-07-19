import type { IBlockRepository } from '@vire/core';
import { blockUser, unblockUser, isBlockedEitherWay, isBlockedBy, listBlockedIds } from '../queries/blocks';

export class DrizzleBlockRepository implements IBlockRepository {
  block(blockerId: string, blockedId: string): Promise<void> { return blockUser(blockerId, blockedId); }
  unblock(blockerId: string, blockedId: string): Promise<void> { return unblockUser(blockerId, blockedId); }
  existsEitherWay(a: string, b: string): Promise<boolean> { return isBlockedEitherWay(a, b); }
  existsDirected(blockerId: string, blockedId: string): Promise<boolean> { return isBlockedBy(blockerId, blockedId); }
  listBlocked(userId: string): Promise<string[]> { return listBlockedIds(userId); }
}
