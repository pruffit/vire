'use client';

import { useTransition } from 'react';
import { actionSetUserRole } from '../actions';
import type { UserRole } from '@vire/db';
import { Select } from '@/components/select';

const ROLES: UserRole[] = ['LISTENER', 'ARTIST', 'MODERATOR', 'ADMIN', 'SUPERADMIN'];
const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: r }));

interface Props {
  userId: string;
  currentRole: UserRole;
  artistProfileId?: string;
}

export function UserRoleSelect({ userId, currentRole }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      size="sm"
      align="end"
      options={ROLE_OPTIONS}
      value={currentRole}
      onValueChange={(role) => startTransition(() => actionSetUserRole(userId, role as UserRole))}
      disabled={pending}
      aria-label="Роль"
      className="w-36"
    />
  );
}
