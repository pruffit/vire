'use client';

import { useTransition } from 'react';
import { actionSetUserRole } from '../actions';
import type { UserRole } from '@vire/db';
import { selectClass } from '@/components/admin/ui';

const ROLES: UserRole[] = ['LISTENER', 'ARTIST', 'MODERATOR', 'ADMIN', 'SUPERADMIN'];

interface Props {
  userId: string;
  currentRole: UserRole;
  artistProfileId?: string;
}

export function UserRoleSelect({ userId, currentRole }: Props) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value as UserRole;
    startTransition(() => actionSetUserRole(userId, role));
  }

  return (
    <select
      defaultValue={currentRole}
      onChange={handleChange}
      disabled={pending}
      className={selectClass}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
