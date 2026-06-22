'use client';

import { useTransition } from 'react';
import { actionSetReleaseStatus } from '../actions';
import { selectClass } from '@/components/admin/ui';

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
      className={selectClass}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
