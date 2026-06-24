'use client';

import { actionSetTrackStatus } from '../actions';
import { ActionSelect } from '@/components/action-select';

type TrackStatus = 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED';

const STATUSES: TrackStatus[] = ['PROCESSING', 'READY', 'BLOCKED', 'FAILED'];
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }));

interface Props {
  trackId: string;
  currentStatus: TrackStatus;
}

export function TrackStatusSelect({ trackId, currentStatus }: Props) {
  return (
    <ActionSelect
      options={STATUS_OPTIONS}
      value={currentStatus}
      onChange={(s) => actionSetTrackStatus(trackId, s as TrackStatus)}
      ariaLabel="Статус трека"
      className="w-36"
    />
  );
}
