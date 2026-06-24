'use client';

import { actionSetUserRole } from '../actions';
import type { UserRole } from '@vire/db';
import { ActionSelect } from '@/components/action-select';

const ROLES: UserRole[] = ['LISTENER', 'ARTIST', 'VIEWER', 'MODERATOR', 'ADMIN', 'SUPERADMIN'];
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r }));

interface Props {
  userId: string;
  currentRole: UserRole;
  artistProfileId?: string;
}

export function UserRoleSelect({ userId, currentRole }: Props) {
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
