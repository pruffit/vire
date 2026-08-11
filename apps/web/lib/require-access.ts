import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { can, type Actor, type Permission } from '@vire/core/access';
import { insertAuditEntry } from '@vire/db';

export type AuditFn = (
  action: string,
  target?: { type: string; id: string },
  meta?: Record<string, unknown>,
) => Promise<void>;

type AccessResult =
  | { ok: true; actor: Actor; audit: AuditFn }
  | { ok: false; response: NextResponse };

type UserResult = { ok: true; actor: Actor } | { ok: false; response: NextResponse };

export function makeAudit(actor: Actor, permission: Permission): AuditFn {
  return async (action, target, meta) => {
    try {
      await insertAuditEntry({
        actorUserId: actor.id,
        actorRole: actor.role,
        permission,
        action,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        meta: meta ?? null,
      });
    } catch (err) {
      // Сбой записи аудита не должен ронять уже выполненную мутацию
      console.error('audit log insert failed', err);
    }
  };
}

export async function requireAccess(permission: Permission): Promise<AccessResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const actor: Actor = { id: session.user.id, role: session.user.role };
  if (!can(actor, permission)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, actor, audit: makeAudit(actor, permission) };
}

export async function requireUser(): Promise<UserResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { ok: true, actor: { id: session.user.id, role: session.user.role } };
}
