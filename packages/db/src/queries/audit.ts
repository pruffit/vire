import { db } from '../client';
import { auditLog } from '../schema';

export interface AuditEntry {
  actorUserId: string | null;
  actorRole: string;
  permission: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function insertAuditEntry(entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    actorRole: entry.actorRole,
    permission: entry.permission,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    meta: entry.meta ?? null,
  });
}
