import { err, ok, ValidationError, ConflictError, NotFoundError, type Result } from '../../../errors';
import type { IReportRepository, ReportTargetType, ReportListItem } from '../repositories/report';

const REASON_MAX = 500;

export class ReportService {
  constructor(private readonly repo: IReportRepository) {}

  async submit(
    reporterId: string,
    targetType: ReportTargetType,
    targetId: string,
    reasonInput: unknown,
  ): Promise<Result<{ id: string }, ValidationError | ConflictError>> {
    const reason = typeof reasonInput === 'string' ? reasonInput.trim() : '';
    if (!reason || reason.length > REASON_MAX) return err(new ValidationError('Причина: 1–500 символов', 'report.reasonLength'));
    if (await this.repo.hasOpenReport(reporterId, targetType, targetId)) {
      return err(new ConflictError('Жалоба уже на рассмотрении', undefined, 'report.alreadyOpen'));
    }

    const created = await this.repo.insert(reporterId, targetType, targetId, reason);
    return ok(created);
  }

  listOpen(limit: number): Promise<ReportListItem[]> { return this.repo.listOpen(limit); }
  countOpen(): Promise<number> { return this.repo.countOpen(); }

  async resolve(
    id: string,
    reviewerId: string,
    status: 'REVIEWED' | 'DISMISSED',
  ): Promise<Result<void, NotFoundError>> {
    const ctx = await this.repo.getContext(id);
    if (!ctx) return err(new NotFoundError('Report', id));
    await this.repo.resolve(id, reviewerId, status);
    return ok(undefined);
  }
}
