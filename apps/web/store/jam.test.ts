import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { ActiveJam } from './jam';

let useJamStore: typeof import('./jam').useJamStore;

const jam: ActiveJam = { code: 'A2B3C4', participantId: 'p1', role: 'GUEST', sessionId: 'guest-1.sig' };

const memory = new Map<string, string>();

beforeAll(async () => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  });

  memory.set('vire-jam', JSON.stringify({ state: { active: jam }, version: 0 }));

  ({ useJamStore } = await import('./jam'));
});

describe('persist: регидрация', () => {
  // Без beforeEach-сброса — проверяем состояние сразу после импорта модуля, до чьих-либо мутаций.
  it('восстанавливает active из localStorage, audioEnabled остаётся дефолтным (false)', () => {
    expect(useJamStore.getState().active).toEqual(jam);
    expect(useJamStore.getState().audioEnabled).toBe(false);
  });
});

describe('actions', () => {
  beforeEach(() => {
    useJamStore.setState({ active: null, audioEnabled: false });
  });

  it('activate ставит active и включает audioEnabled', () => {
    useJamStore.getState().activate(jam);
    expect(useJamStore.getState().active).toEqual(jam);
    expect(useJamStore.getState().audioEnabled).toBe(true);
  });

  it('enableAudio включает звук, не трогая active', () => {
    useJamStore.setState({ active: jam, audioEnabled: false });
    useJamStore.getState().enableAudio();
    expect(useJamStore.getState().audioEnabled).toBe(true);
    expect(useJamStore.getState().active).toEqual(jam);
  });

  it('leave чистит active и audioEnabled', () => {
    useJamStore.getState().activate(jam);
    useJamStore.getState().leave();
    expect(useJamStore.getState().active).toBeNull();
    expect(useJamStore.getState().audioEnabled).toBe(false);
  });
});

describe('persist: partialize', () => {
  beforeEach(() => {
    useJamStore.setState({ active: null, audioEnabled: false });
  });

  it('персистит только active, не audioEnabled', () => {
    useJamStore.getState().activate(jam);
    const partialize = useJamStore.persist.getOptions().partialize;
    expect(partialize).toBeDefined();
    const persisted = partialize!(useJamStore.getState()) as Record<string, unknown>;
    expect(persisted).toEqual({ active: jam });
    expect(persisted.audioEnabled).toBeUndefined();
  });
});
