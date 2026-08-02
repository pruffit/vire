import { describe, it, expect, vi } from 'vitest';
import { JamService, JAM_MAX_PARTICIPANTS, JAM_MAX_ADDS_PER_MIN, JAM_MAX_QUEUE, JAM_REFILL_LIMIT } from './jam';
import { NotFoundError, ConflictError, ValidationError, ForbiddenError } from '../errors';
import type { IJamRepository } from '../repositories/jam';
import type { IJamStateStore } from '../ports/jam-state';
import type { IJamBroadcaster } from '../ports/jam-realtime';
import type { JamPlaybackState } from './jam-sync';
import type { WaveService } from './wave';
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
    mode: 'SYNCED',
    kind: 'JAM',
    speakerParticipantId: null,
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
    source: 'VIRE',
    trackId: `track-${id}`,
    externalId: null,
    externalUrl: null,
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
    setMode: vi.fn().mockResolvedValue(undefined),
    setSpeaker: vi.fn().mockResolvedValue(undefined),
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
    dropPresence: vi.fn().mockResolvedValue(undefined),
    bumpAddCounter: vi.fn().mockResolvedValue(1),
    addSkipVote: vi.fn().mockResolvedValue(1),
    clearSkipVotes: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeBroadcaster(overrides?: Partial<IJamBroadcaster>): IJamBroadcaster {
  return { broadcast: vi.fn().mockResolvedValue(undefined), ...overrides };
}

function makeWave(overrides?: Partial<Pick<WaveService, 'next'>>): Pick<WaveService, 'next'> {
  return { next: vi.fn().mockResolvedValue({ ok: true, value: { tracks: [] } }), ...overrides };
}

function makeService(o?: {
  repo?: IJamRepository;
  state?: IJamStateStore;
  broadcaster?: IJamBroadcaster;
  random?: () => number;
  wave?: Pick<WaveService, 'next'> | null;
}) {
  return new JamService(
    o?.repo ?? makeRepo(),
    o?.state ?? makeState(),
    o?.broadcaster ?? makeBroadcaster(),
    () => NOW,
    o?.random ?? (() => 0.5),
    o?.wave ?? null,
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

  it('defaults to SYNCED when no mode is given', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    await service.create('host-1', null, 'Danya');

    expect(repo.createSession).toHaveBeenCalledWith(expect.objectContaining({ mode: 'SYNCED' }));
  });

  it('forwards an explicit mode to the repository', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    await service.create('host-1', null, 'Danya', 'SPEAKER');

    expect(repo.createSession).toHaveBeenCalledWith(expect.objectContaining({ mode: 'SPEAKER' }));
  });

  it('defaults to JAM when no kind is given', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    await service.create('host-1', null, 'Danya');

    expect(repo.createSession).toHaveBeenCalledWith(expect.objectContaining({ kind: 'JAM' }));
  });

  it('forwards an explicit kind (PARTY) to the repository', async () => {
    const repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    await service.create('host-1', null, 'Danya', 'SYNCED', 'PARTY');

    expect(repo.createSession).toHaveBeenCalledWith(expect.objectContaining({ kind: 'PARTY' }));
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

  it('broadcasts jam:participants with the fresh participant list after a successful join', async () => {
    const guest = makeParticipant({ id: 'p-guest', displayName: 'Guest' });
    const host = makeHostParticipant();
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(null),
      upsertParticipant: vi.fn().mockResolvedValue(guest),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [host, guest], queue: [] }),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, broadcaster });

    const result = await service.join('A2B3C4', { guestSessionId: 'g1' }, 'Guest');

    expect(result.ok).toBe(true);
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:participants', participants: [host, guest] });
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
    const playback: JamPlaybackState = { itemId: 'item-1', startedAtMs: 100, paused: false, pausedPositionMs: 0, version: 2 };
    const repo = makeRepo();
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(playback) });
    const service = makeService({ repo, state });

    const result = await service.getState('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.playback).toEqual(playback);
  });

  it('returns presentParticipantIds from the state store', async () => {
    const repo = makeRepo();
    const state = makeState({ listPresent: vi.fn().mockResolvedValue(['p-guest', 'p-host']) });
    const service = makeService({ repo, state });

    const result = await service.getState('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.presentParticipantIds).toEqual(['p-guest', 'p-host']);
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
    const viireWrite = (id: string, trackId: string, participantId: string) => ({
      id, source: 'VIRE', trackId, externalId: null, externalUrl: null, title: null, artistName: null, coverUrl: null, durationSec: null,
      addedByParticipantId: participantId, addedAt: ADDED_AT,
    });
    expect(repo.replaceQueue).toHaveBeenCalledWith(
      'jam-1',
      [
        viireWrite('q1', 'track-q1', 'p-guest'),
        viireWrite('q2', 'track-q2', 'p-other'),
        { source: 'VIRE', trackId: 'track-new', externalId: null, externalUrl: null, title: null, artistName: null, coverUrl: null, durationSec: null, addedByParticipantId: 'p-guest', addedAt: new Date(NOW) },
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

  it('shuffles the queue using the injected random source and broadcasts jam:queue', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant), getSessionState: vi.fn().mockResolvedValue(sessionState) });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, broadcaster, random: () => 0 });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'shuffle' });

    expect(result.ok).toBe(true);
    expect(repo.replaceQueue).toHaveBeenCalledWith(
      'jam-1',
      [expect.objectContaining({ id: 'q2' }), expect.objectContaining({ id: 'q1' })],
      4,
    );
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', expect.objectContaining({ type: 'jam:queue', version: 4 }));
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

  it('on a PARTY session, adding applies round-robin positioning instead of a plain append', async () => {
    const partyQueue = [
      makeQueueItem('q1', { addedByParticipantId: 'p-a' }),
      makeQueueItem('q2', { addedByParticipantId: 'p-b' }),
      makeQueueItem('q3', { addedByParticipantId: 'p-a' }),
    ];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY', queueVersion: 3 }), participants: [], queue: partyQueue }),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo, state });

    const result = await service.mutateQueue('jam-1', { guestSessionId: 'guest-1' }, { kind: 'add', trackId: 'track-new' });

    expect(result.ok).toBe(true);
    // guestParticipant.id ('p-guest') has 0 tracks so far — round 0 lands before p-a's second track (q3, round 1).
    const written = vi.mocked(repo.replaceQueue).mock.calls[0]![1] as Array<{ id?: string; trackId: string | null }>;
    expect(written.map((i) => i.id ?? i.trackId)).toEqual(['q1', 'q2', 'track-new', 'q3']);
  });
});

describe('JamService.addExternalItem', () => {
  const guestParticipant = makeParticipant({ id: 'p-guest', role: 'GUEST' });
  const externalEntry = { source: 'YOUTUBE' as const, externalId: 'yt-1', externalUrl: 'https://youtu.be/yt-1', title: 'Song', artistName: 'Artist', coverUrl: null, durationSec: 200 };

  it('rejects a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.addExternalItem('jam-1', { guestSessionId: 'ghost' }, externalEntry);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('rejects a regular JAM session with ValidationError', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'JAM' }), participants: [], queue: [] }),
    });
    const service = makeService({ repo });

    const result = await service.addExternalItem('jam-1', { guestSessionId: 'guest-1' }, externalEntry);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });

  it('rejects once the jam has ENDED', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY', status: 'ENDED' }), participants: [], queue: [] }),
    });
    const service = makeService({ repo });

    const result = await service.addExternalItem('jam-1', { guestSessionId: 'guest-1' }, externalEntry);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('rejects when the per-minute add limit is exceeded', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY' }), participants: [], queue: [] }),
    });
    const state = makeState({ bumpAddCounter: vi.fn().mockResolvedValue(JAM_MAX_ADDS_PER_MIN + 1) });
    const service = makeService({ repo, state });

    const result = await service.addExternalItem('jam-1', { guestSessionId: 'guest-1' }, externalEntry);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });

  it('rejects when the queue is full', async () => {
    const full = Array.from({ length: JAM_MAX_QUEUE }, (_, i) => makeQueueItem(`item-${i}`));
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY' }), participants: [], queue: full }),
    });
    const service = makeService({ repo });

    const result = await service.addExternalItem('jam-1', { guestSessionId: 'guest-1' }, externalEntry);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('on a PARTY session, adds the external item and broadcasts jam:queue', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY', queueVersion: 3 }), participants: [], queue: [] }),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, broadcaster });

    const result = await service.addExternalItem('jam-1', { guestSessionId: 'guest-1' }, externalEntry);

    expect(result.ok).toBe(true);
    expect(repo.replaceQueue).toHaveBeenCalledWith(
      'jam-1',
      [{
        source: 'YOUTUBE', trackId: null, externalId: 'yt-1', externalUrl: 'https://youtu.be/yt-1',
        title: 'Song', artistName: 'Artist', coverUrl: null, durationSec: 200,
        addedByParticipantId: 'p-guest', addedAt: new Date(NOW),
      }],
      4,
    );
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', expect.objectContaining({ type: 'jam:queue', version: 4 }));
  });
});

describe('JamService.setPlayback', () => {
  it('forbids a non-participant from controlling playback', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(null),
    });
    const service = makeService({ repo });

    const result = await service.setPlayback('jam-1', { guestSessionId: 'stranger' }, { kind: 'pause', positionMs: 1000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('allows a guest participant (non-host) to control playback', async () => {
    const guestParticipant = makeParticipant({ id: 'p-guest' });
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', { guestSessionId: 'guest-1' }, { kind: 'track', itemId: 'item-1' });

    expect(result.ok).toBe(true);
  });

  it('rejects playback control once the jam has ENDED, even for a participant', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1', status: 'ENDED' })),
      findParticipant: vi.fn().mockResolvedValue(makeHostParticipant()),
    });
    const state = makeState();
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', { userId: 'host-1' }, { kind: 'track', itemId: 'item-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
    expect(state.setPlayback).not.toHaveBeenCalled();
  });

  it('allows the host to start playback and broadcasts jam:playback', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(makeHostParticipant()),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(null) });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster });

    const result = await service.setPlayback('jam-1', { userId: 'host-1' }, { kind: 'play', itemId: 'item-1', positionMs: 5000 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ itemId: 'item-1', startedAtMs: NOW - 5000, paused: false, pausedPositionMs: 0, version: 1 });
    }
    expect(state.setPlayback).toHaveBeenCalledWith('jam-1', result.ok ? result.value : undefined);
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:playback', playback: result.ok ? result.value : undefined });
  });

  it('rejects pause when nothing is currently playing', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(makeHostParticipant()),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', { userId: 'host-1' }, { kind: 'pause', positionMs: 1000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('seek while paused updates pausedPositionMs and keeps paused:true', async () => {
    const current: JamPlaybackState = { itemId: 'item-1', startedAtMs: 0, paused: true, pausedPositionMs: 2000, version: 5 };
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(makeHostParticipant()),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(current) });
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', { userId: 'host-1' }, { kind: 'seek', positionMs: 9000 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ itemId: 'item-1', startedAtMs: 0, paused: true, pausedPositionMs: 9000, version: 6 });
  });

  it('seek while playing recomputes startedAtMs from the clock', async () => {
    const current: JamPlaybackState = { itemId: 'item-1', startedAtMs: NOW - 3000, paused: false, pausedPositionMs: 0, version: 5 };
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(makeHostParticipant()),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(current) });
    const service = makeService({ repo, state });

    const result = await service.setPlayback('jam-1', { userId: 'host-1' }, { kind: 'seek', positionMs: 9000 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.startedAtMs).toBe(NOW - 9000);
  });
});

describe('JamService.voteSkip', () => {
  const guestParticipant = makeParticipant({ id: 'p-guest', role: 'GUEST' });
  const hostParticipant = makeHostParticipant({ id: 'p-host' });
  const currentPlayback: JamPlaybackState = { itemId: 'item-1', startedAtMs: NOW - 5000, paused: false, pausedPositionMs: 0, version: 3 };

  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.voteSkip('jam-1', { guestSessionId: 'ghost' }, 'item-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('rejects a regular JAM session with ValidationError', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ kind: 'JAM' })),
    });
    const service = makeService({ repo });

    const result = await service.voteSkip('jam-1', { guestSessionId: 'guest-1' }, 'item-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
  });

  it('rejects once the jam has ENDED', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ kind: 'PARTY', status: 'ENDED' })),
    });
    const service = makeService({ repo });

    const result = await service.voteSkip('jam-1', { guestSessionId: 'guest-1' }, 'item-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('a vote for a position that already moved on is a silent no-op', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ kind: 'PARTY' })),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue({ ...currentPlayback, itemId: 'item-2' }) });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster });

    const result = await service.voteSkip('jam-1', { guestSessionId: 'guest-1' }, 'item-1');

    expect(result.ok).toBe(true);
    expect(state.addSkipVote).not.toHaveBeenCalled();
    expect(broadcaster.broadcast).not.toHaveBeenCalled();
  });

  it('below threshold: records the vote and only broadcasts jam:skip, without advancing', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ kind: 'PARTY' })),
    });
    const state = makeState({
      getPlayback: vi.fn().mockResolvedValue(currentPlayback),
      addSkipVote: vi.fn().mockResolvedValue(1),
      listPresent: vi.fn().mockResolvedValue(['p-guest', 'p-other', 'p-third']),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster });

    const result = await service.voteSkip('jam-1', { guestSessionId: 'guest-1' }, 'item-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ itemId: 'item-1', votes: 1, needed: 2 });
    expect(state.clearSkipVotes).not.toHaveBeenCalled();
    expect(state.setPlayback).not.toHaveBeenCalled();
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:skip', itemId: 'item-1', votes: 1, needed: 2 });
  });

  it('threshold reached: advances to the next item the same way as {kind:track} and clears votes', async () => {
    const queue = [makeQueueItem('item-1'), makeQueueItem('item-2')];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ kind: 'PARTY' })),
      listQueue: vi.fn().mockResolvedValue(queue),
    });
    const state = makeState({
      getPlayback: vi.fn().mockResolvedValue(currentPlayback),
      addSkipVote: vi.fn().mockResolvedValue(2),
      listPresent: vi.fn().mockResolvedValue(['p-guest', 'p-other']),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster });

    const result = await service.voteSkip('jam-1', { guestSessionId: 'guest-1' }, 'item-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ itemId: 'item-1', votes: 2, needed: 2 });
    expect(state.clearSkipVotes).toHaveBeenCalledWith('jam-1', 'item-1');
    expect(state.setPlayback).toHaveBeenCalledWith('jam-1', expect.objectContaining({ itemId: 'item-2', paused: false }));
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', expect.objectContaining({ type: 'jam:playback' }));
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:skip', itemId: 'item-1', votes: 2, needed: 2 });
  });

  it('threshold reached with no next item: pauses in place instead of ending the jam', async () => {
    const queue = [makeQueueItem('item-1')];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ kind: 'PARTY' })),
      listQueue: vi.fn().mockResolvedValue(queue),
    });
    const state = makeState({
      getPlayback: vi.fn().mockResolvedValue(currentPlayback),
      addSkipVote: vi.fn().mockResolvedValue(1),
      listPresent: vi.fn().mockResolvedValue(['p-guest']),
    });
    const service = makeService({ repo, state });

    const result = await service.voteSkip('jam-1', { guestSessionId: 'guest-1' }, 'item-1');

    expect(result.ok).toBe(true);
    expect(state.setPlayback).toHaveBeenCalledWith('jam-1', expect.objectContaining({ itemId: 'item-1', paused: true }));
    expect(repo.endSession).not.toHaveBeenCalled();
  });

  it('the host skips on the first vote regardless of the threshold', async () => {
    const queue = [makeQueueItem('item-1'), makeQueueItem('item-2')];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(hostParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ kind: 'PARTY' })),
      listQueue: vi.fn().mockResolvedValue(queue),
    });
    const state = makeState({
      getPlayback: vi.fn().mockResolvedValue(currentPlayback),
      addSkipVote: vi.fn().mockResolvedValue(1),
      listPresent: vi.fn().mockResolvedValue(['p-guest', 'p-other', 'p-third', 'p-fourth']),
    });
    const service = makeService({ repo, state });

    const result = await service.voteSkip('jam-1', { userId: 'host-1' }, 'item-1');

    expect(result.ok).toBe(true);
    expect(state.clearSkipVotes).toHaveBeenCalledWith('jam-1', 'item-1');
    expect(state.setPlayback).toHaveBeenCalledWith('jam-1', expect.objectContaining({ itemId: 'item-2' }));
  });
});

describe('JamService.refillFromWave', () => {
  const loggedInParticipant = makeParticipant({ id: 'p-guest', role: 'GUEST', userId: 'user-1', guestSessionId: null });
  const activePlayback: JamPlaybackState = { itemId: 'item-1', startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 };

  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo, wave: makeWave() });

    const result = await service.refillFromWave('jam-1', { userId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('rejects a regular JAM session with ValidationError', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(loggedInParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'JAM' }), participants: [], queue: [] }),
    });
    const service = makeService({ repo, wave: makeWave() });

    const result = await service.refillFromWave('jam-1', { userId: 'user-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ValidationError);
  });

  it('no-op when the wave service is not injected', async () => {
    const queue = [makeQueueItem('item-1')];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(loggedInParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY' }), participants: [loggedInParticipant], queue }),
    });
    const service = makeService({ repo, wave: null });

    const result = await service.refillFromWave('jam-1', { userId: 'user-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.queue).toEqual(queue);
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });

  it('no-op when the queue still has tracks after the current position', async () => {
    const queue = [makeQueueItem('item-1'), makeQueueItem('item-2')];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(loggedInParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY', queueVersion: 3 }), participants: [loggedInParticipant], queue }),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(activePlayback) });
    const wave = makeWave();
    const service = makeService({ repo, state, wave });

    const result = await service.refillFromWave('jam-1', { userId: 'user-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.queue).toEqual(queue);
    expect(wave.next).not.toHaveBeenCalled();
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });

  it('no-op when the wave returns no tracks', async () => {
    const queue = [makeQueueItem('item-1')];
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(loggedInParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY' }), participants: [loggedInParticipant], queue }),
    });
    const state = makeState({ getPlayback: vi.fn().mockResolvedValue(activePlayback) });
    const wave = makeWave();
    const service = makeService({ repo, state, wave });

    const result = await service.refillFromWave('jam-1', { userId: 'user-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.queue).toEqual(queue);
    expect(repo.replaceQueue).not.toHaveBeenCalled();
  });

  it('empty tail: appends wave tracks to the tail without round-robin and broadcasts jam:queue', async () => {
    const queue = [makeQueueItem('item-1')];
    const wave = makeWave({
      next: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          tracks: [{
            id: 'wave-1', title: 'W', artistName: 'A', artistSlug: 'a', releaseId: 'r',
            coverUrl: null, accentColor: null, isExplicit: false, version: null, feat: [],
          }],
        },
      }),
    });
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(loggedInParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession({ kind: 'PARTY', queueVersion: 3 }), participants: [loggedInParticipant], queue }),
      listQueue: vi.fn().mockResolvedValue([...queue, makeQueueItem('item-2', { trackId: 'wave-1' })]),
    });
    const state = makeState({
      getPlayback: vi.fn().mockResolvedValue(activePlayback),
      listPresent: vi.fn().mockResolvedValue(['p-guest']),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster, wave });

    const result = await service.refillFromWave('jam-1', { userId: 'user-1' });

    expect(result.ok).toBe(true);
    expect(wave.next).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'jam:jam-1', userId: 'user-1', currentTrackId: 'track-item-1', limit: JAM_REFILL_LIMIT,
    }));
    expect(repo.replaceQueue).toHaveBeenCalledWith(
      'jam-1',
      [
        expect.objectContaining({ id: 'item-1' }),
        expect.objectContaining({ source: 'VIRE', trackId: 'wave-1', addedByParticipantId: null }),
      ],
      4,
    );
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', expect.objectContaining({ type: 'jam:queue', version: 4 }));
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

  it('removes a participant when called by the host and broadcasts jam:participants', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeSession({ hostUserId: 'host-1' })),
      findParticipant: vi.fn().mockResolvedValue(hostParticipant),
      getSessionState: vi.fn().mockResolvedValue({ session: makeSession(), participants: [hostParticipant], queue: [] }),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, broadcaster });

    const result = await service.kick('jam-1', 'host-1', 'p-guest');

    expect(result.ok).toBe(true);
    expect(repo.removeParticipant).toHaveBeenCalledWith('jam-1', 'p-guest');
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:participants', participants: [hostParticipant] });
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

describe('JamService.setMode', () => {
  const hostParticipant = makeHostParticipant({ id: 'p-host' });
  const guestParticipant = makeParticipant({ id: 'p-guest' });

  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.setMode('jam-1', { guestSessionId: 'ghost' }, 'SPEAKER');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
  });

  it('forbids a non-host participant from changing the mode', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant) });
    const service = makeService({ repo });

    const result = await service.setMode('jam-1', { guestSessionId: 'guest-1' }, 'SPEAKER');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(repo.setMode).not.toHaveBeenCalled();
  });

  it('rejects once the jam has ENDED', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(hostParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ status: 'ENDED' })),
    });
    const service = makeService({ repo });

    const result = await service.setMode('jam-1', { userId: 'host-1' }, 'SPEAKER');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('lets the host switch the mode and broadcasts jam:session', async () => {
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(hostParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ speakerParticipantId: 'p-guest' })),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, broadcaster });

    const result = await service.setMode('jam-1', { userId: 'host-1' }, 'SPEAKER');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ mode: 'SPEAKER', speakerParticipantId: 'p-guest' });
    expect(repo.setMode).toHaveBeenCalledWith('jam-1', 'SPEAKER');
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:session', mode: 'SPEAKER', speakerParticipantId: 'p-guest' });
  });
});

describe('JamService.claimSpeaker', () => {
  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const service = makeService({ repo });

    const result = await service.claimSpeaker('jam-1', { guestSessionId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(repo.setSpeaker).not.toHaveBeenCalled();
  });

  it('rejects once the jam has ENDED', async () => {
    const guestParticipant = makeParticipant({ id: 'p-guest' });
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ status: 'ENDED' })),
    });
    const service = makeService({ repo });

    const result = await service.claimSpeaker('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ConflictError);
  });

  it('lets any participant claim the speaker role and broadcasts jam:session', async () => {
    const guestParticipant = makeParticipant({ id: 'p-guest' });
    const repo = makeRepo({
      findParticipant: vi.fn().mockResolvedValue(guestParticipant),
      findById: vi.fn().mockResolvedValue(makeSession({ mode: 'SPEAKER' })),
    });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, broadcaster });

    const result = await service.claimSpeaker('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ mode: 'SPEAKER', speakerParticipantId: 'p-guest' });
    expect(repo.setSpeaker).toHaveBeenCalledWith('jam-1', 'p-guest');
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:session', mode: 'SPEAKER', speakerParticipantId: 'p-guest' });
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

describe('JamService.listPresent', () => {
  it('forwards to the state store', async () => {
    const state = makeState({ listPresent: vi.fn().mockResolvedValue(['p-guest']) });
    const service = makeService({ state });

    const result = await service.listPresent('jam-1');

    expect(result).toEqual(['p-guest']);
  });
});

describe('JamService.leave', () => {
  it('forbids a non-participant', async () => {
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(null) });
    const state = makeState();
    const service = makeService({ repo, state });

    const result = await service.leave('jam-1', { guestSessionId: 'ghost' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(ForbiddenError);
    expect(state.dropPresence).not.toHaveBeenCalled();
  });

  it('drops presence for the participant and broadcasts the fresh jam:presence list', async () => {
    const guestParticipant = makeParticipant({ id: 'p-guest' });
    const repo = makeRepo({ findParticipant: vi.fn().mockResolvedValue(guestParticipant) });
    const state = makeState({ listPresent: vi.fn().mockResolvedValue(['p-host']) });
    const broadcaster = makeBroadcaster();
    const service = makeService({ repo, state, broadcaster });

    const result = await service.leave('jam-1', { guestSessionId: 'guest-1' });

    expect(result.ok).toBe(true);
    expect(state.dropPresence).toHaveBeenCalledWith('jam-1', 'p-guest');
    expect(broadcaster.broadcast).toHaveBeenCalledWith('jam-1', { type: 'jam:presence', participantIds: ['p-host'] });
  });
});
