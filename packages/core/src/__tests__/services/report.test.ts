import { describe, it, expect, vi } from 'vitest';
import { ReportService } from '../../services/report';
import { ValidationError, ConflictError, NotFoundError } from '../../errors';
import type { IReportRepository, ReportListItem } from '../../repositories/report';

function makeRepo(o?: Partial<IReportRepository>): IReportRepository {
  return {
    hasOpenReport: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockResolvedValue({ id: 'report-1' }),
    listOpen: vi.fn().mockResolvedValue([]),
    countOpen: vi.fn().mockResolvedValue(0),
    resolve: vi.fn().mockResolvedValue(undefined),
    getContext: vi.fn().mockResolvedValue(null),
    ...o,
  };
}

const CTX: ReportListItem = {
  id: 'report-1', reporterId: 'u1', reporterName: 'Аня',
  targetType: 'USER', targetId: 'u2', targetLabel: 'Боря',
  reason: 'спам', status: 'OPEN', createdAt: new Date(),
};

describe('ReportService.submit', () => {
  it('отклоняет пустую причину', async () => {
    const repo = makeRepo();
    const r = await new ReportService(repo).submit('u1', 'USER', 'u2', '  ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('отклоняет причину длиннее 500 символов', async () => {
    const repo = makeRepo();
    const r = await new ReportService(repo).submit('u1', 'USER', 'u2', 'x'.repeat(501));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ValidationError);
  });

  it('анти-дубль: уже есть OPEN-репорт на пару → ConflictError', async () => {
    const repo = makeRepo({ hasOpenReport: vi.fn().mockResolvedValue(true) });
    const r = await new ReportService(repo).submit('u1', 'USER', 'u2', 'спам');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(ConflictError);
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('создаёт жалобу с обрезанной причиной', async () => {
    const repo = makeRepo();
    const r = await new ReportService(repo).submit('u1', 'MESSAGE', 'm1', '  спам  ');
    expect(r).toEqual({ ok: true, value: { id: 'report-1' } });
    expect(repo.insert).toHaveBeenCalledWith('u1', 'MESSAGE', 'm1', 'спам');
  });
});

describe('ReportService.listOpen / countOpen', () => {
  it('делегируют в репозиторий', async () => {
    const repo = makeRepo({ listOpen: vi.fn().mockResolvedValue([CTX]), countOpen: vi.fn().mockResolvedValue(1) });
    const service = new ReportService(repo);
    expect(await service.listOpen(20)).toEqual([CTX]);
    expect(await service.countOpen()).toBe(1);
  });
});

describe('ReportService.resolve', () => {
  it('NotFoundError, если жалобы нет', async () => {
    const repo = makeRepo({ getContext: vi.fn().mockResolvedValue(null) });
    const r = await new ReportService(repo).resolve('ghost', 'mod1', 'DISMISSED');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBeInstanceOf(NotFoundError);
    expect(repo.resolve).not.toHaveBeenCalled();
  });

  it('резолвит существующую жалобу', async () => {
    const repo = makeRepo({ getContext: vi.fn().mockResolvedValue(CTX) });
    const r = await new ReportService(repo).resolve('report-1', 'mod1', 'REVIEWED');
    expect(r.ok).toBe(true);
    expect(repo.resolve).toHaveBeenCalledWith('report-1', 'mod1', 'REVIEWED');
  });
});
