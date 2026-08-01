import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { JamParticipantRole } from '@vire/core';

export interface ActiveJam {
  code: string;
  participantId: string;
  role: JamParticipantRole;
  sessionId: string | null;
}

interface State {
  active: ActiveJam | null;
  /** Не персистится: после F5 браузер блокирует автоплей, звук включается первым жестом. */
  audioEnabled: boolean;
}

interface Store extends State {
  activate(jam: ActiveJam): void;
  enableAudio(): void;
  leave(): void;
}

type PersistedState = Pick<State, 'active'>;

export const useJamStore = create<Store>()(
  persist(
    (set) => ({
      active: null,
      audioEnabled: false,
      activate: (jam) => set({ active: jam, audioEnabled: true }),
      enableAudio: () => set({ audioEnabled: true }),
      leave: () => set({ active: null, audioEnabled: false }),
    }),
    {
      name: 'vire-jam',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedState => ({ active: state.active }),
    },
  ),
);
