import type { IReportRepository, ReportTargetType, ReportListItem } from '@vire/core';
import { hasOpenReport, insertReport, listOpenReports, countOpenReports, resolveReport, getReportContext } from '../queries/reports';

export class DrizzleReportRepository implements IReportRepository {
  hasOpenReport(reporterId: string, targetType: ReportTargetType, targetId: string): Promise<boolean> {
    return hasOpenReport(reporterId, targetType, targetId);
  }
  insert(reporterId: string, targetType: ReportTargetType, targetId: string, reason: string): Promise<{ id: string }> {
    return insertReport(reporterId, targetType, targetId, reason);
  }
  listOpen(limit: number): Promise<ReportListItem[]> { return listOpenReports(limit); }
  countOpen(): Promise<number> { return countOpenReports(); }
  resolve(id: string, reviewerId: string, status: 'REVIEWED' | 'DISMISSED'): Promise<void> {
    return resolveReport(id, reviewerId, status);
  }
  getContext(id: string): Promise<ReportListItem | null> { return getReportContext(id); }
}
