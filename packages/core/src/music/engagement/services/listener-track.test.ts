import { describe, it, expect, vi } from 'vitest';
import { ListenerTrackService } from './listener-track';
import { NotFoundError } from '../../../errors';
import type { IListenerTrackRepository } from '../repositories/listener-track';
import type { AggregateMoment } from '../types/moment';

function makeRepo(overrides?: Partial<IListenerTrackRepository>): IListenerTrackRepository {
  return {
    trackExists: vi.fn().mockResolvedValue(true),
    getLikeState: vi.fn().mockResolvedValue(false),
    like: vi.fn().mockResolvedValue(undefined),
    unlike: vi.fn().mockResolvedValue(undefined),
    getAggregateMoments: vi.fn().mockResolvedValue([]),
    addMoment: vi.fn().mockResolvedValue(undefined),
    getPublicLyrics: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('ListenerTrackService.getLikeState', () => {
  it('returns ok(liked) from repo', async () => {
    const repo = makeRepo({ getLikeState: vi.fn().mockResolvedValue(true) });
    const service = new ListenerTrackService(repo);

    const result = await service.getLikeState('user-1', 'track-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
    expect(repo.getLikeState).toHaveBeenCalledWith('user-1', 'track-1');
  });
});

describe('ListenerTrackService.like', () => {
  it('likes when track exists', async () => {
    const repo = makeRepo();
    const service = new ListenerTrackService(repo);

    const result = await service.like('user-1', 'track-1');

    expect(result.ok).toBe(true);
    expect(repo.like).toHaveBeenCalledWith('user-1', 'track-1');
  });

  it('returns err(NotFoundError) when track does not exist', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const service = new ListenerTrackService(repo);

    const result = await service.like('user-1', 'missing');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.like).not.toHaveBeenCalled();
  });
});

describe('ListenerTrackService.unlike', () => {
  it('unlikes without checking track existence (1:1 with route)', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const service = new ListenerTrackService(repo);

    const result = await service.unlike('user-1', 'track-1');

    expect(result.ok).toBe(true);
    expect(repo.unlike).toHaveBeenCalledWith('user-1', 'track-1');
    expect(repo.trackExists).not.toHaveBeenCalled();
  });
});

describe('ListenerTrackService.getMoments', () => {
  const moments: AggregateMoment[] = [{ positionSec: 30, count: 4 }];

  it('returns ok(moments) when track exists', async () => {
    const repo = makeRepo({ getAggregateMoments: vi.fn().mockResolvedValue(moments) });
    const service = new ListenerTrackService(repo);

    const result = await service.getMoments('track-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(moments);
  });

  it('returns err(NotFoundError) when track does not exist', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const service = new ListenerTrackService(repo);

    const result = await service.getMoments('missing');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.getAggregateMoments).not.toHaveBeenCalled();
  });
});

describe('ListenerTrackService.addMoment', () => {
  it('adds moment with anonymous userId when track exists', async () => {
    const repo = makeRepo();
    const service = new ListenerTrackService(repo);

    const result = await service.addMoment('track-1', 30, null);

    expect(result.ok).toBe(true);
    expect(repo.addMoment).toHaveBeenCalledWith('track-1', 30, null);
  });

  it('returns err(NotFoundError) when track does not exist', async () => {
    const repo = makeRepo({ trackExists: vi.fn().mockResolvedValue(false) });
    const service = new ListenerTrackService(repo);

    const result = await service.addMoment('missing', 30, 'user-1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(NotFoundError);
    expect(repo.addMoment).not.toHaveBeenCalled();
  });
});

describe('ListenerTrackService.getPublicLyrics', () => {
  it('returns ok(lyrics) from repo', async () => {
    const lyrics = [{ t: 0, text: 'line' }];
    const repo = makeRepo({ getPublicLyrics: vi.fn().mockResolvedValue(lyrics) });
    const service = new ListenerTrackService(repo);

    const result = await service.getPublicLyrics('track-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(lyrics);
  });

  it('returns ok(null) for unpublished/missing track (repo does not distinguish)', async () => {
    const repo = makeRepo();
    const service = new ListenerTrackService(repo);

    const result = await service.getPublicLyrics('track-1');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });
});
