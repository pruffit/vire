import type { JamMode } from '@vire/core';

export const JAM_MODES: JamMode[] = ['SYNCED', 'SPEAKER'];

/** t — переводчик namespace 'jam.mode'. */
export function jamModeLabel(mode: JamMode, t: (key: string) => string): string {
  return t(mode);
}

export function jamModeOptions(t: (key: string) => string): { value: JamMode; label: string }[] {
  return JAM_MODES.map((value) => ({ value, label: t(value) }));
}
