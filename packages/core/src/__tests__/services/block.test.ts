import { describe, it, expect, vi } from 'vitest';
import { BlockService } from '../../services/block';
import { ValidationError } from '../../errors';
import type { IBlockRepository } from '../../repositories/block';

function makeRepo(o?: Partial<IBlockRepository>): IBlockRepository {
  return {
    block: vi.fn().mockResolvedValue(undefined),
    unblock: vi.fn().mockResolvedValue(undefined),
    existsEitherWay: vi.fn().mockResolvedValue(false),
    existsDirected: vi.fn().mockResolvedValue(false),
    listBlocked: vi.fn().mockResolvedValue([]),
    ...o,
  };
}

describe('BlockService.block', () => {
  it('отклоняет блокировку самого себя', async () => {
    const repo = makeRepo();
    const r = await new BlockService(repo).block('u1', 'u1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
    expect(repo.block).not.toHaveBeenCalled();
  });

  it('делегирует в репозиторий (идемпотентность — на уровне репо)', async () => {
    const repo = makeRepo();
    const r = await new BlockService(repo).block('u1', 'u2');
    expect(r.ok).toBe(true);
    expect(repo.block).toHaveBeenCalledWith('u1', 'u2');
  });
});

describe('BlockService.unblock', () => {
  it('делегирует в репозиторий', async () => {
    const repo = makeRepo();
    await new BlockService(repo).unblock('u1', 'u2');
    expect(repo.unblock).toHaveBeenCalledWith('u1', 'u2');
  });
});

describe('BlockService.isBlocked / listBlocked', () => {
  it('isBlocked делегирует existsEitherWay', async () => {
    const repo = makeRepo({ existsEitherWay: vi.fn().mockResolvedValue(true) });
    const blocked = await new BlockService(repo).isBlocked('u1', 'u2');
    expect(blocked).toBe(true);
    expect(repo.existsEitherWay).toHaveBeenCalledWith('u1', 'u2');
  });

  it('listBlocked делегирует в репозиторий', async () => {
    const repo = makeRepo({ listBlocked: vi.fn().mockResolvedValue(['u2', 'u3']) });
    const ids = await new BlockService(repo).listBlocked('u1');
    expect(ids).toEqual(['u2', 'u3']);
  });
});
