import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';

const h = vi.hoisted(() => ({
  listStaleLiveSessions: vi.fn(),
  endSession: vi.fn(),
  reapJamRedisState: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleJamRepository: class {
    listStaleLiveSessions = h.listStaleLiveSessions;
    endSession = h.endSession;
  },
}));
vi.mock('../lib/jam-cleanup.js', () => ({ reapJamRedisState: h.reapJamRedisState }));
vi.mock('../queues/connection.js', () => ({ connection: {} }));

import { handle } from './jam-reaper.worker.js';

function makeJob(): Job {
  return {} as Job;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.endSession.mockResolvedValue(undefined);
  h.reapJamRedisState.mockResolvedValue(undefined);
});

describe('jam-reaper handle', () => {
  it('does nothing when there are no stale sessions', async () => {
    h.listStaleLiveSessions.mockResolvedValue([]);

    await handle(makeJob());

    expect(h.endSession).not.toHaveBeenCalled();
    expect(h.reapJamRedisState).not.toHaveBeenCalled();
  });

  it('queries stale sessions with a 12h threshold', async () => {
    h.listStaleLiveSessions.mockResolvedValue([]);

    await handle(makeJob());

    expect(h.listStaleLiveSessions).toHaveBeenCalledWith(12);
  });

  it('ends every stale session and clears its Redis state', async () => {
    h.listStaleLiveSessions.mockResolvedValue([{ id: 'jam-1' }, { id: 'jam-2' }]);

    await handle(makeJob());

    expect(h.endSession).toHaveBeenNthCalledWith(1, 'jam-1');
    expect(h.reapJamRedisState).toHaveBeenNthCalledWith(1, 'jam-1');
    expect(h.endSession).toHaveBeenNthCalledWith(2, 'jam-2');
    expect(h.reapJamRedisState).toHaveBeenNthCalledWith(2, 'jam-2');
  });
});
