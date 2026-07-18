import { DrizzleReportRepository } from '@vire/db';
import { ReportService } from '@vire/core';

export function reportService() {
  return new ReportService(new DrizzleReportRepository());
}
