'use client';

import { useTransition } from 'react';
import { actionSetUserRole } from '../actions';
import type { UserRole } from '@vire/db';

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
      className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-40 cursor-pointer"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}
