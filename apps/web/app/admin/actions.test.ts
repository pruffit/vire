import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  auth, revalidatePath, transcodeAdd,
  trackUpdate, trackGetSourceKey, trackGetArtistTrackSources, trackSetStatus,
  releaseUpdate, moodsSet, moodsSetGenres,
} = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  transcodeAdd: vi.fn(),
  trackUpdate: vi.fn(),
  trackGetSourceKey: vi.fn(),
  trackGetArtistTrackSources: vi.fn(),
  trackSetStatus: vi.fn(),
  releaseUpdate: vi.fn(),
  moodsSet: vi.fn(),
  moodsSetGenres: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('@/lib/queue', () => ({ transcodeQueue: { add: transcodeAdd } }));
vi.mock('@vire/db', () => ({
  db: {},
  setUserRole: vi.fn(),
  verifyArtist: vi.fn(),
  setArtistActive: vi.fn(),
  setTrackStatus: vi.fn(),
  setReleaseStatus: vi.fn(),
  createArtistForUser: vi.fn(),
  addArtistMember: vi.fn(),
  removeArtistMember: vi.fn(),
  listArtistMembers: vi.fn(),
  ALL_MOODS: ['CHILL', 'NIGHT'],
  ALL_TRACK_GENRES: ['ROCK', 'POP'],
  DrizzleReleaseRepository: class {
    update = releaseUpdate;
  },
  DrizzleTrackRepository: class {
    update = trackUpdate;
    getSourceKey = trackGetSourceKey;
    getArtistTrackSources = trackGetArtistTrackSources;
    setStatus = trackSetStatus;
  },
  DrizzleTrackMoodsRepository: class {
    set = moodsSet;
    setGenres = moodsSetGenres;
  },
  DrizzleArtistPostRepository: class {},
  DrizzlePlaylistRepository: class {},
  DrizzleArtistRepository: class {},
}));

import {
  actionAdminUpdateTrack, actionAdminUpdateRelease, actionRetranscodeTrack, actionRetranscodeArtist,
} from './actions';

const mockedAuth = vi.mocked(auth);

beforeEach(() => vi.clearAllMocks());

const MUTATE_SESSION = { user: { id: 'admin-1', role: 'ADMIN' } };
const VIEW_ONLY_SESSION = { user: { id: 'viewer-1', role: 'VIEWER' } };

const trackInput = {
  title: 'New Title',
  version: null,
  trackNumber: 1,
  isExplicit: false,
  isExclusive: false,
  isWip: false,
  bpm: 120,
  musicalKey: '8A',
  moods: ['CHILL', 'BOGUS'],
  genres: ['ROCK', 'BOGUS'],
  credits: [],
  lyrics: null,
};

const releaseInput = {
  title: 'New Release',
  type: 'EP',
  genre: 'ROCK',
  releaseDate: null,
  description: null,
  linerNotes: null,
};

describe('actionAdminUpdateTrack', () => {
  it('is a silent no-op when canMutate is false', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    const result = await actionAdminUpdateTrack('track-1', trackInput);

    expect(result).toEqual({});
    expect(trackUpdate).not.toHaveBeenCalled();
  });

  it('returns the validation error and does not touch the repo', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);

    const result = await actionAdminUpdateTrack('track-1', { ...trackInput, title: '   ' });

    expect(result).toEqual({ error: 'Название: 1–200 символов' });
    expect(trackUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('filters moods/genres against the allow-list, updates, then revalidates', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);

    const result = await actionAdminUpdateTrack('track-1', trackInput);

    expect(result).toEqual({ ok: true });
    expect(trackUpdate).toHaveBeenCalledWith('track-1', expect.objectContaining({ title: 'New Title' }));
    expect(moodsSet).toHaveBeenCalledWith('track-1', ['CHILL']);
    expect(moodsSetGenres).toHaveBeenCalledWith('track-1', ['ROCK']);
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tracks');
  });
});

describe('actionAdminUpdateRelease', () => {
  it('is a silent no-op when canMutate is false', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    const result = await actionAdminUpdateRelease('release-1', releaseInput);

    expect(result).toEqual({});
    expect(releaseUpdate).not.toHaveBeenCalled();
  });

  it('returns the validation error and does not touch the repo', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);

    const result = await actionAdminUpdateRelease('release-1', { ...releaseInput, type: 'BOGUS' });

    expect(result).toEqual({ error: 'Неверный тип' });
    expect(releaseUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updates then revalidates on success', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);

    const result = await actionAdminUpdateRelease('release-1', releaseInput);

    expect(result).toEqual({ ok: true });
    expect(releaseUpdate).toHaveBeenCalledWith('release-1', expect.objectContaining({ title: 'New Release' }));
    expect(revalidatePath).toHaveBeenCalledWith('/admin/releases');
  });
});

describe('actionRetranscodeTrack', () => {
  it('is a silent no-op when canMutate is false', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    const result = await actionRetranscodeTrack('track-1');

    expect(result).toEqual({});
    expect(trackGetSourceKey).not.toHaveBeenCalled();
  });

  it('returns an error when there is no vault source', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);
    trackGetSourceKey.mockResolvedValue(null);

    const result = await actionRetranscodeTrack('track-1');

    expect(result).toEqual({ error: 'Нет исходника в vault — пересобрать нечем' });
    expect(transcodeAdd).not.toHaveBeenCalled();
  });

  it('sets status, enqueues, then revalidates', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);
    trackGetSourceKey.mockResolvedValue('tracks/track-1/source.flac');

    const result = await actionRetranscodeTrack('track-1');

    expect(result).toEqual({ ok: true });
    expect(trackSetStatus).toHaveBeenCalledWith('track-1', 'PROCESSING');
    expect(transcodeAdd).toHaveBeenCalledWith({ trackId: 'track-1', sourceKey: 'tracks/track-1/source.flac' });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tracks');
  });
});

describe('actionRetranscodeArtist', () => {
  it('is a silent no-op when canMutate is false', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    const result = await actionRetranscodeArtist('artist-1');

    expect(result).toEqual({});
    expect(trackGetArtistTrackSources).not.toHaveBeenCalled();
  });

  it('returns an error when the artist has no vault sources', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);
    trackGetArtistTrackSources.mockResolvedValue([]);

    const result = await actionRetranscodeArtist('artist-1');

    expect(result).toEqual({ error: 'Нет треков с исходником в vault' });
    expect(transcodeAdd).not.toHaveBeenCalled();
  });

  it('queues every track and revalidates both admin pages', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);
    trackGetArtistTrackSources.mockResolvedValue([
      { trackId: 't1', sourceKey: 'tracks/t1/source.flac' },
      { trackId: 't2', sourceKey: 'tracks/t2/source.flac' },
    ]);

    const result = await actionRetranscodeArtist('artist-1');

    expect(result).toEqual({ queued: 2 });
    expect(transcodeAdd).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith('/admin/artists');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/tracks');
  });
});
