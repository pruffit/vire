import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  auth, revalidatePath, transcodeAdd,
  trackUpdate, trackGetSourceKey, trackGetArtistTrackSources, trackSetStatus,
  releaseUpdate, moodsSet, moodsSetGenres, insertAuditEntry, flagSetEnabled,
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
  insertAuditEntry: vi.fn(),
  flagSetEnabled: vi.fn(),
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
  insertAuditEntry,
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
  DrizzleFeatureFlagRepository: class {},
}));
vi.mock('@/lib/feature-flags', () => ({ featureFlagService: () => ({ setEnabled: flagSetEnabled }) }));

import {
  actionAdminUpdateTrack, actionAdminUpdateRelease, actionRetranscodeTrack, actionRetranscodeArtist,
  actionSetUserRole, actionSetFeatureFlag,
} from './actions';

const mockedAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  insertAuditEntry.mockResolvedValue(undefined);
});

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
  it('throws Forbidden for VIEWER (no admin.content.moderate)', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    await expect(actionAdminUpdateTrack('track-1', trackInput)).rejects.toThrow('Forbidden');
    expect(trackUpdate).not.toHaveBeenCalled();
    expect(insertAuditEntry).not.toHaveBeenCalled();
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
    expect(insertAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1', actorRole: 'ADMIN', permission: 'admin.content.moderate',
      action: 'track.update', targetType: 'track', targetId: 'track-1',
    }));
  });
});

describe('actionAdminUpdateRelease', () => {
  it('throws Forbidden for VIEWER (no admin.content.moderate)', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    await expect(actionAdminUpdateRelease('release-1', releaseInput)).rejects.toThrow('Forbidden');
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
  it('throws Forbidden for VIEWER (no admin.content.moderate)', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    await expect(actionRetranscodeTrack('track-1')).rejects.toThrow('Forbidden');
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
  it('throws Forbidden for VIEWER (no admin.content.moderate)', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    await expect(actionRetranscodeArtist('artist-1')).rejects.toThrow('Forbidden');
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

describe('actionSetUserRole', () => {
  const MODERATOR_SESSION = { user: { id: 'mod-1', role: 'MODERATOR' } };

  // admin.users.manage — фикс эскалации: MODERATOR больше не может назначить себе SUPERADMIN.
  it('throws Forbidden for MODERATOR (admin.users.manage is ADMIN+)', async () => {
    mockedAuth.mockResolvedValue(MODERATOR_SESSION as never);

    await expect(actionSetUserRole('user-1', 'SUPERADMIN')).rejects.toThrow('Forbidden');
    expect(insertAuditEntry).not.toHaveBeenCalled();
  });

  it('throws Forbidden for VIEWER', async () => {
    mockedAuth.mockResolvedValue(VIEW_ONLY_SESSION as never);

    await expect(actionSetUserRole('user-1', 'ADMIN')).rejects.toThrow('Forbidden');
    expect(insertAuditEntry).not.toHaveBeenCalled();
  });

  it('sets the role for ADMIN, revalidates, and writes an audit entry', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);

    await actionSetUserRole('user-1', 'MODERATOR');

    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
    expect(insertAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1', actorRole: 'ADMIN', permission: 'admin.users.manage',
      action: 'user.role.set', targetType: 'user', targetId: 'user-1', meta: { role: 'MODERATOR' },
    }));
  });

  it('a failed audit write does not throw or block the mutation result', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);
    insertAuditEntry.mockRejectedValue(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(actionSetUserRole('user-1', 'MODERATOR')).resolves.toBeUndefined();

    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
    errorSpy.mockRestore();
  });
});

describe('actionSetFeatureFlag', () => {
  it('throws Forbidden for MODERATOR (no admin.flags.manage)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'mod-1', role: 'MODERATOR' } } as never);

    await expect(actionSetFeatureFlag('sdui.home', true)).rejects.toThrow('Forbidden');
    expect(flagSetEnabled).not.toHaveBeenCalled();
    expect(insertAuditEntry).not.toHaveBeenCalled();
  });

  it('rejects a flag outside the registry without writing', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);

    await expect(actionSetFeatureFlag('nope', true)).resolves.toEqual({ error: 'Неизвестный флаг' });
    expect(flagSetEnabled).not.toHaveBeenCalled();
    expect(insertAuditEntry).not.toHaveBeenCalled();
  });

  it('sets the flag and writes an audit entry', async () => {
    mockedAuth.mockResolvedValue(MUTATE_SESSION as never);

    await expect(actionSetFeatureFlag('sdui.home', true)).resolves.toEqual({});

    expect(flagSetEnabled).toHaveBeenCalledWith('sdui.home', true, 'admin-1');
    expect(revalidatePath).toHaveBeenCalledWith('/admin/flags');
    expect(insertAuditEntry).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1', actorRole: 'ADMIN', permission: 'admin.flags.manage',
      action: 'flag.set', targetType: 'flag', targetId: 'sdui.home', meta: { enabled: true },
    }));
  });
});
