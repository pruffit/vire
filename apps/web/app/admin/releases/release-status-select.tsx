'use client';

import { actionSetReleaseStatus } from '../actions';
import { ActionSelect } from '@/components/action-select';

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
  return (
    <ActionSelect
      options={STATUS_OPTIONS}
      value={currentStatus}
      onChange={(s) => actionSetReleaseStatus(releaseId, s as ReleaseStatus)}
      ariaLabel="Статус релиза"
      className="w-40"
    />
  );
}
