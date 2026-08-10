export type ReportTargetType = 'USER' | 'MESSAGE';
export type ReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';

export type ReportListItem = {
  id: string;
  reporterId: string;
  reporterName: string | null;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string | null;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
};

export interface IReportRepository {
  hasOpenReport(reporterId: string, targetType: ReportTargetType, targetId: string): Promise<boolean>;
  insert(reporterId: string, targetType: ReportTargetType, targetId: string, reason: string): Promise<{ id: string }>;
  listOpen(limit: number): Promise<ReportListItem[]>;
  countOpen(): Promise<number>;
  resolve(id: string, reviewerId: string, status: 'REVIEWED' | 'DISMISSED'): Promise<void>;
  getContext(id: string): Promise<ReportListItem | null>;
}
