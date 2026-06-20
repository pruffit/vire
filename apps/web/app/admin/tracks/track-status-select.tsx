'use client';

import { useTransition } from 'react';
import { actionSetTrackStatus } from '../actions';

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
      className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-40 cursor-pointer"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
