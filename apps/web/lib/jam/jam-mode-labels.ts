import type { JamMode } from '@vire/core';

export const JAM_MODE_LABELS: Record<JamMode, string> = {
  SYNCED: 'В наушниках',
  SPEAKER: 'На колонке',
};

export const JAM_MODE_OPTIONS: { value: JamMode; label: string }[] = [
  { value: 'SYNCED', label: JAM_MODE_LABELS.SYNCED },
  { value: 'SPEAKER', label: JAM_MODE_LABELS.SPEAKER },
];
