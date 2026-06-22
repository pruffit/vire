'use client';

import { useTransition } from 'react';
import { actionSetTrackStatus } from '../actions';
import { Select } from '@/components/select';

type TrackStatus = 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED';

const STATUSES: TrackStatus[] = ['PROCESSING', 'READY', 'BLOCKED', 'FAILED'];
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }));

interface Props {
  trackId: string;
  currentStatus: TrackStatus;
}

export function TrackStatusSelect({ trackId, currentStatus }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      size="sm"
      align="end"
      options={STATUS_OPTIONS}
      value={currentStatus}
      onValueChange={(s) => startTransition(() => actionSetTrackStatus(trackId, s as TrackStatus))}
      disabled={pending}
      aria-label="Статус трека"
      className="w-36"
    />
  );
}
