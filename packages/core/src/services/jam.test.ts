import { describe, it, expect, vi } from 'vitest';
import { JamService, JAM_MAX_PARTICIPANTS, JAM_MAX_ADDS_PER_MIN, JAM_MAX_QUEUE } from './jam';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../errors';
import type { IJamRepository } from '../repositories/jam';
import type { IJamStateStore } from '../ports/jam-state';
import type { IJamBroadcaster } from '../ports/jam-realtime';
import type { JamPlaybackState } from './jam-sync';
import type { JamSession, JamParticipant, JamQueueItem } from '../types/jam';

const NOW = 1_700_000_000_000;
const ADDED_AT = new Date('2026-07-20T12:00:00Z');

function makeSession(overrides?: Partial<JamSession>): JamSession {
  return {
    id: 'jam-1',
    code: 'A2B3C4',
    hostUserId: 'host-1',
    title: 'Party',
    status: 'LIVE',
    queueVersion: 3,
    savedPlaylistId: null,
    createdAt: ADDED_AT,
    lastActivityAt: ADDED_AT,
    endedAt: null,
    ...overrides,
  };
}

function makeParticipant(overrides?: Partial<JamParticipant>): JamParticipant {
  return {
    id: 'p-guest',
    jamId: 'jam-1',
    userId: null,
    guestSessionId: 'guest-1',
    displayName: 'Guest',
    role: 'GUEST',
    joinedAt: ADDED_AT,
    lastSeenAt: ADDED_AT,
    ...overrides,
  };
}

function makeHostParticipant(overrides?: Partial<JamParticipant>): JamParticipant {
  return makeParticipant({ id: 'p-host', userId: 'host-1', guestSessionId: null, role: 'HOST', displayName: 'Host', ...overrides });
}

function makeQueueItem(id: string, overrides?: Partial<JamQueueItem>): JamQueueItem {
  return {
    id,
    trackId: `track-${id}`,
    position: 0,
    addedByParticipantId: 'p-guest',
    addedAt: ADDED_AT,
    title: 'Song',
    durationSec: 200,
    artistName: 'Artist',
    artistSlug: 'artist',
    releaseId: 'release-1',
    coverUrl: null,
    accentColor: null,
    isExplicit: false,
    version: null,
    feat: [],
    ...overrides,
  };
}

function makeRepo(overrides?: Partial<IJamRepository>): IJamRepository {
  return {
    createSession: vi.fn().mockResolvedValue(makeSession()),
    findByCode: vi.fn().mockResolvedValue(makeSession()),
    findById: vi.fn().mockResolvedValue(makeSession()),
    getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [], queue: [] }),
    findParticipant: vi.fn().mockResolvedValue(makeParticipant()),
    upsertParticipant: vi.fn().mockResolvedValue(makeParticipant()),
    touchParticipant: vi.fn().mockResolvedValue(undefined),
    removeParticipant: vi.fn().mockResolvedValue(undefined),
    listQueue: vi.fn().mockResolvedValue([]),
    replaceQueue: vi.fn().mockResolvedValue(undefined),
    countParticipants: vi.fn().mockResolvedValue(1),
    countQueueItems: vi.fn().mockResolvedValue(0),
    endSession: vi.fn().mockResolvedValue(undefined),
    setSavedPlaylist: vi.fn().mockResolvedValue(undefined),
    touchActivity: vi.fn().mockResolvedValue(undefined),
    listStaleLiveSessions: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

function makeState(overrides?: Partial<IJamStateStore>): IJamStateStore {
  return {
    getPlayback: vi.fn().mockResolvedValue(null),
    setPlayback: vi.fn().mockResolvedValue(undefined),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    listPresent: vi.fn().mockResolvedValue([]),
    bumpAddCounter: vi.fn().mockResolvedValue(1),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeBroadcaster(overrides?: Partial<IJamBroadcaster>): IJamBroadcaster {
  return { broadcast: vi.fn().mockResolvedValue(undefined), ...overrides };
}

function makeService(o?: {
  repo?: IJamRepository;
  state?: IJamStateStore;
  broadcaster?: IJamBroadcaster;
  random?: () => number;
}) {
  return new JamService(
    o?.repo ?? makeRepo(),
    o?.state ?? makeState(),
    o?.broadcaster ?? makeBroadcaster(),
    () => NOW,
    o?.random ?? (() => 0.5),
  );
}

describe('JamService.create', () => {
  it('creates a session and inserts the host as HOST participant', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.create('host-1', 'Party', 'Danya');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.code).toBe('A2B3C4');
    expect(repo.upsertParticipant).toHaveBeenCalledWith({
      jamId: 'jam-1',
      identity: { userId: 'host-1' },
      displayName: 'Danya',
      role: 'HOST',
    });
  });

  it('retries code generation on collision and succeeds on the next attempt', async () => {
    const findByCode = vi.fn().mockResolvedValueOnce(makeSession()).mockResolvedValueOnce(null);
    const repo = makeRepo({ findByCode });
    const service = makeService({ repo });

    const result = await service.create('host-1', null, 'Danya');

    expect(result.ok).toBe(true);
    expect(findByCode).toHaveBeenCalledTimes(2);
    expect(repo.createSession).toHaveBeenCalledTimes(1);
  });

  it('gives up after 5 collisions and returns ConflictError', async () => {
    const findByCode = vi.fn().mockResolvedValue(makeSession());
    const repo = makeRepo({ findByCode });
    const service = makeService({ repo });

    const result = await service.create('host-1', null, 'Danya');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(findByCode).toHaveBeenCalledTimes(5);
    expect(repo.createSession).not.toHaveBeenCalled();
  });
});

describe('JamService.resolveCode', () => {
  it('rejects an invalid code with ValidationError', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });

    const result = await service.resolveCode('bad');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.findByCode).not.toHaveBeenCalled();
  });

  it('returns NotFoundError when the code does not match any session', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.resolveCode('A2B3C4');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns the session for a matching code', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });

    const result = await service.resolveCode('a2b3c4');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe('jam-1');
    expect(repo.findByCode).toHaveBeenCalledWith('A2B3C4');
  });
});

describe('JamService.preview', () => {
  it('rejects an invalid code with ValidationError', async () => {
    const service = makeService();

    const result = await service.preview('bad');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
  });

  it('returns NotFoundError when the code does not match any session', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.preview('A2B3C4');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns the host display name from the participant list, without requiring identity', async () => {
    const host = makeHostParticipant({ displayName: 'Danya' });
    const repo = makeRepo({
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [host, makeParticipant()], queue: [] }),
    });
    const service = makeService({ repo });

    const result = await service.preview('A2B3C4');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hostDisplayName).toBe('Danya');
    expect(repo.findParticipant).not.toHaveBeenCalled();
  });

  it('falls back to a generic label when the session state has no host participant', async () => {
    const repo = makeRepo({ getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [], queue: [] }) });
    const service = makeService({ repo });

    const result = await service.preview('A2B3C4');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hostDisplayName).toBe('Хост');
  });
});

describe('JamService.join', () => {
  it('rejects an invalid code with ValidationError', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });

    const result = await service.join('bad', { guestSessionId: 'g1' }, 'Guest');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.findByCode).not.toHaveBeenCalled();
  });

  it('returns NotFoundError when the code does not match any session', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.join('A2B3C4', { guestSessionId: 'g1' }, 'Guest');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('rejects joining an ENDED session with ConflictError', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(makeSession({ status: 'ENDED' })) });
    const service = makeService({ repo });

    const result = await service.join('A2B3C4', { guestSessionId: 'g1' }, 'Guest');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('rejects a new participant when the room is full', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(null),
      countParticipants: vi.fn().mockResolvedValue(JAM_MAX_PARTICIPANTS),
    });
    const service = makeService({ repo });

    const result = await service.join('A2B3C4', { guestSessionId: 'g1' }, 'Guest');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(repo.upsertParticipant).not.toHaveBeenCalled();
  });

  it('does not enforce the participant cap on rejoin (already a member)', async () => {
    const countParticipants = vi.fn().mockResolvedValue(JAM_MAX_PARTICIPANTS);
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(makeParticipant()), countParticipants });
    const service = makeService({ repo });

    const result = await service.join('A2B3C4', { guestSessionId: 'guest-1' }, 'Guest');

    expect(result.ok).toBe(true);
    expect(countParticipants).not.toHaveBeenCalled();
  });

  it('rejoining as host keeps the HOST role even though join always requests GUEST', async () => {
    let stored = makeHostParticipant();
    const repo = makeRepo({
      findByCode: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(stored),
      // репозиторий не понижает уже сохранённую роль на конфликте — join() всегда просит GUEST
      upsertParticipant: vi.fn().mockImplementation(async (input) => {
        stored = { ...stored, displayName: input.displayName };
        return stored;
      }),
    });
    const service = makeService({ repo });

    const result = await service.join('A2B3C4', { userId: 'host-1' }, 'Danya (again)');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.participant.role).toBe('HOST');
    expect(repo.upsertParticipant).toHaveBeenCalledWith(expect.objectContaining({ role: 'GUEST' }));
  });
});

describe('JamService.getState', () => {
  it('returns Forbidden for a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.getState('jam-1', { guestSessionId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('returns NotFoundError when the session is gone', async () => {
    const repo = makeRepo({ getSessionState: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.getState('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns the full state including playback for a participant', async () => {
    const playback: JamPlaybackState = { trackId: 't1', startedAtMs: 100, paused: false, pausedPositionMs: 0, version: 2 };
    const repo = makeRepo();
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(playback) });
    const service = makeService({ repo, state });

    const result = await service.getState('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.playback).toEqual(playback);
  });
});

describe('JamService.assertParticipant', () => {
  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.assertParticipant('jam-1', { guestSessionId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('returns the participant record for a member', async () => {
    const participant = makeParticipant();
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(participant) });
    const service = makeService({ repo });

    const result = await service.assertParticipant('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(participant);
  });
});

describe('JamService.resolveId', () => {
  it('returns NotFoundError when the session does not exist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.resolveId('jam-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('returns the session by id', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });

    const result = await service.resolveId('jam-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe('jam-1');
  });
});

describe('JamService.getQueueForSave', () => {
  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.getQueueForSave('jam-1', { guestSessionId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('returns NotFoundError when the session is gone', async () => {
    const repo = makeRepo({ getSessionState: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.getQueueForSave('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
  });

  it('reports isHost true for the host participant', async () => {
    const hostParticipant = makeHostParticipant();
    const queue = [makeQueueItem('q1')];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(hostParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [hostParticipant], queue }),
    });
    const service = makeService({ repo });

    const result = await service.getQueueForSave('jam-1', { userId: 'host-1' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isHost).toBe(true);
      expect(result.value.queue).toEqual(queue);
    }
  });

  it('reports isHost false for a guest participant', async () => {
    const guestParticipant = makeParticipant();
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [guestParticipant], queue: [] }),
    });
    const service = makeService({ repo });

    const result = await service.getQueueForSave('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.isHost).toBe(false);
  });
});

describe('JamService.recordSavedPlaylist', () => {
  it('forwards to the repository', async () => {
    const repo = makeRepo();
    const service = makeService({ repo });

    await service.recordSavedPlaylist('jam-1', 'playlist-1');

    expect(repo.setSavedPlaylist).toHaveBeenCalledWith('jam-1', 'playlist-1');
  });
});

describe('JamService.mutateQueue', () => {
  const guestParticipant = makeParticipant({ id: 'p-guest', role: 'GUEST' });
  const hostParticipant = makeHostParticipant({ id: 'p-host' });
  const ownQueueItem = makeQueueItem('q1', { addedByParticipantId: 'p-guest' });
  const otherQueueItem = makeQueueItem('q2', { addedByParticipantId: 'p-other' });
  const sessionState = { session: makeSession({ queueVersion: 3 }), participants: [hostParticipant, guestParticipant], queue: [ownQueueItem, otherQueueItem] };

  it('rejects mutations from a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'ghost' }, { kind: 'add', trackId: 't1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('a guest can add a track, incrementing queue_version and broadcasting jam:queue', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant), getSessionState: vi.fn().mockResolvedValue(sessionState) });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, broadcaster });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'add', trackId: 'track-new' });

    expect(result.ok).toBe(true);
    expect(repo.replaceQueue).toHaveBeenCalledWith(
      'jam-1',
      [
        { id: 'q1', trackId: 'track-q1', addedByParticipantId: 'p-guest', addedAt: ADDED_AT },
        { id: 'q2', trackId: 'track-q2', addedByParticipantId: 'p-other', addedAt: ADDED_AT },
        { trackId: 'track-new', addedByParticipantId: 'p-guest', addedAt: new Date(NOW) },
      ],
      4,
    );
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', expect.objectContaining({ type: 'jam:queue', version: 4 }));
  });

  it('a guest can move a track', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant), getSessionState: vi.fn().mockResolvedValue(sessionState) });
    const service = makeService({ repo });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'move', itemId: 'q2', toPosition: 0 });

    expect(result.ok).toBe(true);
    expect(repo.replaceQueue).toHaveBeenCalledWith('jam-1', [expect.objectContaining({ id: 'q2' }), expect.objectContaining({ id: 'q1' })], 4);
  });

  it('a guest can remove their own track', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant), getSessionState: vi.fn().mockResolvedValue(sessionState) });
    const service = makeService({ repo });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'remove', itemId: 'q1' });

    expect(result.ok).toBe(true);
  });

  it('a guest cannot remove someone else\'s track', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant), getSessionState: vi.fn().mockResolvedValue(sessionState) });
    const service = makeService({ repo });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'remove', itemId: 'q2' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });

  it('the host can remove any track', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(hostParticipant), getSessionState: vi.fn().mockResolvedValue(sessionState) });
    const service = makeService({ repo });

    const result = await service.mutateQueue('jam-1', { userId: 'host-1' }, { kind: 'remove', itemId: 'q2' });

    expect(result.ok).toBe(true);
  });

  it('rejects adding when the per-minute add limit is exceeded', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant) });
    const state = makeState({ bumpAddCounter: vi.fn().mockResolvedValue(JAM_MAX_ADDS_PER_MIN + 1) });
    const service = makeService({ repo, state });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'add', trackId: 't1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });

  it('rejects adding when the queue is full', async () => {
    const full = Array.from({ length: JAM_MAX_QUEUE }, (_, i) => makeQueueItem(`item-${i}`));
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [], queue: full }),
    });
    const service = makeService({ repo });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'add', trackId: 't1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('rejects any queue mutation once the jam has ENDED', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ status: 'ENDED' }), participants: [], queue: [] }),
    });
    const service = makeService({ repo });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'add', trackId: 't1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });
});

describe('JamService.setPlayback', () => {
  it('forbids a guest (non-host caller) from controlling playback', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const service = makeService({ repo });

    const result = await service.setPlayback('jam-1', 'guest-user-id', { kind: 'pause', positionMs: 1000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('rejects host playback control once the jam has ENDED', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1', status: 'ENDED' })) });
    const state = makeState();
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', 'host-1', { kind: 'track', trackId: 't1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(state.setPlayback).not.toHaveBeenCalled();
  });

  it('allows the host to start playback and broadcasts jam:playback', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(null) });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster });

    const result = await service.setPlayback('jam-1', 'host-1', { kind: 'play', trackId: 't1', positionMs: 5000 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ trackId: 't1', startedAtMs: NOW - 5000, paused: false, pausedPositionMs: 0, version: 1 });
    }
    expect(state.setPlayback).toHaveBeenCalledWith('jam-1', result.ok ? result.value : undefined);
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:playback', playback: result.ok ? result.value : undefined });
  });

  it('rejects pause when nothing is currently playing', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', 'host-1', { kind: 'pause', positionMs: 1000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('seek while paused updates pausedPositionMs and keeps paused:true', async () => {
    const current: JamPlaybackState = { trackId: 't1', startedAtMs: 0, paused: true, pausedPositionMs: 2000, version: 5 };
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(current) });
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', 'host-1', { kind: 'seek', positionMs: 9000 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ trackId: 't1', startedAtMs: 0, paused: true, pausedPositionMs: 9000, version: 6 });
  });

  it('seek while playing recomputes startedAtMs from the clock', async () => {
    const current: JamPlaybackState = { trackId: 't1', startedAtMs: NOW - 3000, paused: false, pausedPositionMs: 0, version: 5 };
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(current) });
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', 'host-1', { kind: 'seek', positionMs: 9000 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.startedAtMs).toBe(NOW - 9000);
  });
});

describe('JamService.endJam', () => {
  it('ends the session, clears state, and broadcasts jam:ended', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const state = makeState();
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster });

    const result = await service.endJam('jam-1', 'host-1');

    expect(result.ok).toBe(true);
    expect(repo.endSession).toHaveBeenCalledWith('jam-1');
    expect(state.clear).toHaveBeenCalledWith('jam-1');
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:ended' });
  });

  it('forbids a non-host from ending the jam', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const service = makeService({ repo });

    const result = await service.endJam('jam-1', 'someone-else');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });
});

describe('JamService.kick', () => {
  const hostParticipant = makeHostParticipant({ id: 'p-host' });

  it('removes a participant when called by the host', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(hostParticipant),
    });
    const service = makeService({ repo });

    const result = await service.kick('jam-1', 'host-1', 'p-guest');

    expect(result.ok).toBe(true);
    expect(repo.removeParticipant).toHaveBeenCalledWith('jam-1', 'p-guest');
  });

  it('forbids a non-host from kicking', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })) });
    const service = makeService({ repo });

    const result = await service.kick('jam-1', 'someone-else', 'p-guest');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(repo.removeParticipant).not.toHaveBeenCalled();
  });

  it('rejects a host kicking themselves', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(hostParticipant),
    });
    const service = makeService({ repo });

    const result = await service.kick('jam-1', 'host-1', hostParticipant.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.removeParticipant).not.toHaveBeenCalled();
  });
});

describe('JamService.heartbeat', () => {
  it('touches the participant and forwards heartbeat to the state store', async () => {
    const guestParticipant = makeParticipant({ id: 'p-guest' });
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant) });
    const state = makeState();
    const service = makeService({ repo, state });

    const result = await service.heartbeat('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    expect(repo.touchParticipant).toHaveBeenCalledWith('p-guest');
    expect(state.heartbeat).toHaveBeenCalledWith('jam-1', 'p-guest');
  });

  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.heartbeat('jam-1', { guestSessionId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });
});
