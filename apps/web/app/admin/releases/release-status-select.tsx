'use client';

import { useTransition } from 'react';
import { actionSetReleaseStatus } from '../actions';

type ReleaseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
const STATUSES: ReleaseStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export function ReleaseStatusSelect({
  releaseId,
  currentStatus,
}: {
  releaseId: string;
  currentStatus: ReleaseStatus;
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as ReleaseStatus;
    startTransition(() => actionSetReleaseStatus(releaseId, status));
  }

  return (
    <select
      defaultValue={currentStatus}
      onChange={handleChange}
      disabled={pending}
      className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-40 cursor-pointer"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
