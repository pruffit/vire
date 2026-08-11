import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertAuditEntry } = vi.hoisted(() => ({ insertAuditEntry: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ insertAuditEntry }));

import { auth } from '@/auth';
import { requireAccess, requireUser } from './require-access';

const mockedAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  insertAuditEntry.mockResolvedValue(undefined);
});

describe('requireAccess', () => {
  it('401 when there is no session', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const result = await requireAccess('admin.read');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('403 when the role lacks the permission', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'LISTENER' } } as never);

    const result = await requireAccess('admin.read');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('ok with actor and a callable audit stub when the role has the permission', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);

    const result = await requireAccess('admin.read');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.actor).toEqual({ id: 'u1', role: 'ADMIN' });
    await expect(result.audit('some.action')).resolves.toBeUndefined();
  });

  it('audit writes actor/permission from closure plus the caller-supplied fields', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);

    const result = await requireAccess('admin.content.moderate');
    if (!result.ok) throw new Error('unreachable');

    await result.audit('track.analyze', { type: 'track', id: 't1' }, { queued: true });

    expect(insertAuditEntry).toHaveBeenCalledWith({
      actorUserId: 'u1',
      actorRole: 'ADMIN',
      permission: 'admin.content.moderate',
      action: 'track.analyze',
      targetType: 'track',
      targetId: 't1',
      meta: { queued: true },
    });
  });

  it('a failed audit write does not reject and is swallowed', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as never);
    insertAuditEntry.mockRejectedValue(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await requireAccess('admin.read');
    if (!result.ok) throw new Error('unreachable');

    await expect(result.audit('some.action')).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('403 for VIEWER on admin.content.moderate', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'VIEWER' } } as never);

    const result = await requireAccess('admin.content.moderate');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.response.status).toBe(403);
  });
});

describe('requireUser', () => {
  it('401 when there is no session', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const result = await requireUser();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('ok with the actor when there is a session, regardless of role', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1', role: 'LISTENER' } } as never);

    const result = await requireUser();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.actor).toEqual({ id: 'u1', role: 'LISTENER' });
  });
});
