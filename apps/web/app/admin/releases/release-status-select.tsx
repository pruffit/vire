'use client';

import { useTransition } from 'react';
import { actionSetReleaseStatus } from '../actions';
import { Select } from '@/components/select';

type ReleaseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
const STATUSES: ReleaseStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }));

export function ReleaseStatusSelect({
  releaseId,
  currentStatus,
}: {
  releaseId: string;
  currentStatus: ReleaseStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      size="sm"
      align="end"
      options={STATUS_OPTIONS}
      value={currentStatus}
      onValueChange={(s) => startTransition(() => actionSetReleaseStatus(releaseId, s as ReleaseStatus))}
      disabled={pending}
      aria-label="Статус релиза"
      className="w-40"
    />
  );
}
