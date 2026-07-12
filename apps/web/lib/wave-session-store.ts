import type { IWaveSessionStore } from '@vire/core';
import { getWaveSession, appendWaveServed, setWaveSessionSeed } from './wave-session';

/** Тонкий адаптер IWaveSessionStore поверх lib/wave-session.ts — Redis-логика и
 *  деградация при недоступности Redis остаются там, без изменений. */
export class WaveSessionStore implements IWaveSessionStore {
  get(sessionId: string) {
    return getWaveSession(sessionId);
  }

  appendServed(sessionId: string, trackIds: string[]) {
    return appendWaveServed(sessionId, trackIds);
  }

  setSeed(sessionId: string, seed: { mood?: string; genre?: string }) {
    return setWaveSessionSeed(sessionId, seed);
  }
}
