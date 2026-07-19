import { alias } from 'drizzle-orm/pg-core';
import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { reports, users, messages } from '../schema';
import type { ReportTargetType, ReportListItem } from '@vire/core';

const targetUsers = alias(users, 'target_users');

type ReportRow = {
  id: string;
  reporterId: string;
  reporterName: string | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED';
  createdAt: Date;
  targetUserName: string | null;
  messageBody: string | null;
};

function toListItem(row: ReportRow): ReportListItem {
  return {
    id: row.id,
    reporterId: row.reporterId,
    reporterName: row.reporterName,
    targetType: row.targetType,
    targetId: row.targetId,
    targetLabel: row.targetType === 'USER' ? row.targetUserName : row.messageBody,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function baseSelect() {
  return db
    .select({
      id: reports.id,
      reporterId: reports.reporterId,
      reporterName: users.name,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      targetUserName: targetUsers.name,
      messageBody: messages.body,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .leftJoin(targetUsers, and(eq(reports.targetType, 'USER'), eq(targetUsers.id, reports.targetId)))
    .leftJoin(messages, and(eq(reports.targetType, 'MESSAGE'), eq(messages.id, reports.targetId)));
}

export async function hasOpenReport(reporterId: string, targetType: ReportTargetType, targetId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(
      eq(reports.reporterId, reporterId),
      eq(reports.targetType, targetType),
      eq(reports.targetId, targetId),
      eq(reports.status, 'OPEN'),
    ))
    .limit(1);
  return !!row;
}

export async function insertReport(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<{ id: string }> {
  const [row] = await db.insert(reports).values({ reporterId, targetType, targetId, reason }).returning({ id: reports.id });
  return row!;
}

export async function listOpenReports(limit: number): Promise<ReportListItem[]> {
  const rows = await baseSelect().where(eq(reports.status, 'OPEN')).orderBy(desc(reports.createdAt)).limit(limit);
  return rows.map(toListItem);
}

export async function countOpenReports(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(reports).where(eq(reports.status, 'OPEN'));
  return Number(row?.n ?? 0);
}

export async function getReportContext(id: string): Promise<ReportListItem | null> {
  const [row] = await baseSelect().where(eq(reports.id, id)).limit(1);
  return row ? toListItem(row) : null;
}

export async function resolveReport(id: string, reviewerId: string, status: 'REVIEWED' | 'DISMISSED'): Promise<void> {
  await db.update(reports).set({ status, reviewedBy: reviewerId, reviewedAt: new Date() }).where(eq(reports.id, id));
}
