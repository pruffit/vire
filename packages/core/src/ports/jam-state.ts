import type { JamPlaybackState } from '../services/jam-sync';

// core не знает про Redis — web-композиция инъектирует реализацию поверх lib/jam/jam-state.ts.
export interface IJamStateStore {
  /** Недоступный Redis → null (деградация — ответственность реализации). */
  getPlayback(jamId: string): Promise<JamPlaybackState | null>;
  setPlayback(jamId: string, state: JamPlaybackState): Promise<void>;
  heartbeat(jamId: string, participantKey: string): Promise<void>;
  listPresent(jamId: string): Promise<string[]>;
  /** 0 = «лимит не превышен» — деградация не должна блокировать людей. */
  bumpAddCounter(jamId: string, participantKey: string): Promise<number>;
  clear(jamId: string): Promise<void>;
}
