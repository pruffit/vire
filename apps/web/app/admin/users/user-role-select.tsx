'use client';

import { actionSetUserRole } from '../actions';
import type { UserRole } from '@vire/db';
import { ActionSelect } from '@/components/action-select';
import { RoleBadge } from '@/components/admin/ui';

const ROLES: UserRole[] = ['LISTENER', 'ARTIST', 'VIEWER', 'MODERATOR', 'ADMIN', 'SUPERADMIN'];
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r }));

interface Props {
  userId: string;
  currentRole: UserRole;
  artistProfileId?: string;
  canManageUsers: boolean;
}

export function UserRoleSelect({ userId, currentRole, canManageUsers }: Props) {
  if (!canManageUsers) return <RoleBadge role={currentRole} />;

  return (
    <ActionSelect
      options={ROLE_OPTIONS}
      value={currentRole}
      onChange={(role) => actionSetUserRole(userId, role as UserRole)}
      ariaLabel="Роль"
      className="w-36"
    />
  );
}
