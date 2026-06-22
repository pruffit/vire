'use client';

import { useTransition } from 'react';
import { actionSetTrackStatus } from '../actions';
import { selectClass } from '@/components/admin/ui';

type TrackStatus = 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED';

const STATUSES: TrackStatus[] = ['PROCESSING', 'READY', 'BLOCKED', 'FAILED'];

interface Props {
  trackId: string;
  currentStatus: TrackStatus;
}

export function TrackStatusSelect({ trackId, currentStatus }: Props) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value as TrackStatus;
    startTransition(() => actionSetTrackStatus(trackId, status));
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
