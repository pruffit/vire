'use client';

import { actionSetReleaseStatus } from '../actions';
import { ActionSelect } from '@/components/action-select';
import { ReleaseStatusBadge } from '@/components/admin/ui';

type ReleaseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
const STATUSES: ReleaseStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }));

export function ReleaseStatusSelect({
  releaseId,
  currentStatus,
  canMutate,
}: {
  releaseId: string;
  currentStatus: ReleaseStatus;
  canMutate: boolean;
}) {
  if (!canMutate) return <ReleaseStatusBadge status={currentStatus} />;

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
