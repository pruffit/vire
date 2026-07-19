import { describe, it, expect, vi } from 'vitest';
import { UserDirectoryService } from '../../services/user-directory';
import type { IUserDirectoryRepository, UserDirectoryHit } from '../../repositories/user-directory';

function makeRepo(o?: Partial<IUserDirectoryRepository>): IUserDirectoryRepository {
  return {
    searchByName: vi.fn().mockResolvedValue([]),
    ...o,
  };
}

const hit = (id: string, name: string): UserDirectoryHit => ({ id, name, image: null });

describe('UserDirectoryService.search', () => {
  it('пусто ниже порога длины (1 символ)', async () => {
    const repo = makeRepo();
    const r = await new UserDirectoryService(repo).search('a', 'viewer', 10);
    expect(r).toEqual({ ok: true, value: [] });
    expect(repo.searchByName).not.toHaveBeenCalled();
  });

  it('пусто на пустой строке', async () => {
    const repo = makeRepo();
    const r = await new UserDirectoryService(repo).search('', 'viewer', 10);
    expect(r).toEqual({ ok: true, value: [] });
    expect(repo.searchByName).not.toHaveBeenCalled();
  });

  it('тримит пробелы перед проверкой порога', async () => {
    const repo = makeRepo();
    const r = await new UserDirectoryService(repo).search('  a  ', 'viewer', 10);
    expect(r).toEqual({ ok: true, value: [] });
    expect(repo.searchByName).not.toHaveBeenCalled();
  });

  it('ищет по триму запроса на пороге длины (2 символа)', async () => {
    const repo = makeRepo({ searchByName: vi.fn().mockResolvedValue([hit('u2', 'Аня')]) });
    const r = await new UserDirectoryService(repo).search('  ан  ', 'viewer', 10);
    expect(r).toEqual({ ok: true, value: [hit('u2', 'Аня')] });
    expect(repo.searchByName).toHaveBeenCalledWith('ан', 10, 'viewer');
  });
});
