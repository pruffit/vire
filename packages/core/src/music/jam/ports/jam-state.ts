import type { JamPlaybackState } from '../services/jam-sync';

// core не знает про Redis — web-композиция инъектирует реализацию поверх lib/jam/jam-state.ts.
export interface IJamStateStore {
  /** Недоступный Redis → null (деградация — ответственность реализации). */
  getPlayback(jamId: string): Promise<JamPlaybackState | null>;
  setPlayback(jamId: string, state: JamPlaybackState): Promise<void>;
  heartbeat(jamId: string, participantKey: string): Promise<void>;
  listPresent(jamId: string): Promise<string[]>;
  dropPresence(jamId: string, participantKey: string): Promise<void>;
  /** 0 = «лимит не превышен» — деградация не должна блокировать людей. */
  bumpAddCounter(jamId: string, participantKey: string): Promise<number>;
  /** Голос за скип текущей позиции; идемпотентно на повторный голос. Возвращает размер SET после добавления, 0 при недоступном Redis. */
  addSkipVote(jamId: string, itemId: string, participantKey: string): Promise<number>;
  clearSkipVotes(jamId: string, itemId: string): Promise<void>;
  clear(jamId: string): Promise<void>;
}
