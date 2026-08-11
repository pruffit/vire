import { describe, it, expect } from 'vitest';
import { can } from './can';
import { ROLE_PERMISSIONS, type Permission, type PlatformRole } from './permissions';

const ROLES = Object.keys(ROLE_PERMISSIONS) as PlatformRole[];
const PERMISSIONS: Permission[] = [
  'admin.panel.view',
  'admin.read',
  'admin.content.moderate',
  'admin.users.manage',
  'admin.jobs.run',
  'staff.content.preview',
];

describe('can', () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      const expected = ROLE_PERMISSIONS[role].includes(permission);
      it(`${role} ${expected ? 'имеет' : 'не имеет'} '${permission}'`, () => {
        expect(can({ id: 'u1', role }, permission)).toBe(expected);
      });
    }
  }

  it('нет актора → всегда false', () => {
    expect(can(null, 'admin.read')).toBe(false);
    expect(can(undefined, 'admin.read')).toBe(false);
  });

  it('ARTIST не имеет ни одного права', () => {
    for (const permission of PERMISSIONS) {
      expect(can({ id: 'u1', role: 'ARTIST' }, permission)).toBe(false);
    }
  });

  it('MODERATOR не может admin.users.manage и admin.jobs.run', () => {
    const actor = { id: 'u1', role: 'MODERATOR' as const };
    expect(can(actor, 'admin.users.manage')).toBe(false);
    expect(can(actor, 'admin.jobs.run')).toBe(false);
  });

  it('VIEWER имеет admin.read, но не admin.content.moderate', () => {
    const actor = { id: 'u1', role: 'VIEWER' as const };
    expect(can(actor, 'admin.read')).toBe(true);
    expect(can(actor, 'admin.content.moderate')).toBe(false);
  });
});

describe('can — неизвестная роль', () => {
  it('роль вне матрицы (устаревший JWT) не роняет гейт и прав не даёт', () => {
    const stale = { id: 'u1', role: 'CURATOR' as unknown as PlatformRole };
    expect(can(stale, 'admin.read')).toBe(false);
    expect(can(stale, 'admin.panel.view')).toBe(false);
  });
});
