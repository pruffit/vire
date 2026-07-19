import { err, ok, ValidationError, type Result } from '../errors';
import type { IBlockRepository } from '../repositories/block';

export class BlockService {
  constructor(private readonly repo: IBlockRepository) {}

  async block(blockerId: string, blockedId: string): Promise<Result<void, ValidationError>> {
    if (blockerId === blockedId) return err(new ValidationError('Нельзя заблокировать самого себя'));
    await this.repo.block(blockerId, blockedId);
    return ok(undefined);
  }

  async unblock(blockerId: string, blockedId: string): Promise<Result<void, never>> {
    await this.repo.unblock(blockerId, blockedId);
    return ok(undefined);
  }

  isBlocked(a: string, b: string): Promise<boolean> { return this.repo.existsEitherWay(a, b); }
  isBlockedByMe(viewerId: string, targetId: string): Promise<boolean> { return this.repo.existsDirected(viewerId, targetId); }
  listBlocked(userId: string): Promise<string[]> { return this.repo.listBlocked(userId); }
}
