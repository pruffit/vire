import { describe, it, expect, beforeEach } from 'vitest';
import { getWaveTracks } from '../wave';
import { getFreshFeedCandidates } from '../feed';
import { resetDb, makeArtist, makeRelease, makeTrack, makeVisibleArtist } from './db-harness';

beforeEach(resetDb);

const neutralWaveParams = {
  currentTrackId: null,
  excludeIds: [],
  limit: 50,
  seedMood: null,
  seedGenre: null,
  sessionMood: null,
  sessionGenre: null,
  taste: null,
  keySets: null,
  recentArtistIds: [],
  userId: null,
};

describe('гейт видимости в волне', () => {
  it('в волну не попадают треки скрытого артиста, черновиков и не-READY', async () => {
    const { artist, track: playable } = await makeVisibleArtist();

    const hidden = await makeArtist({ isActive: false });
    const hiddenRelease = await makeRelease(hidden.id);
    const hiddenTrack = await makeTrack(hiddenRelease.id);

    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id);

    const published = await makeRelease(artist.id);
    const processing = await makeTrack(published.id, { status: 'PROCESSING' });

    const ids = (await getWaveTracks(neutralWaveParams)).map((t) => t.id);
    expect(ids).toContain(playable.id);
    expect(ids).not.toContain(hiddenTrack.id);
    expect(ids).not.toContain(draftTrack.id);
    expect(ids).not.toContain(processing.id);
  });

  it('excludeIds убирает трек из выдачи', async () => {
    const { track } = await makeVisibleArtist();

    expect((await getWaveTracks(neutralWaveParams)).map((t) => t.id)).toContain(track.id);
    const excluded = await getWaveTracks({ ...neutralWaveParams, excludeIds: [track.id] });
    expect(excluded.map((t) => t.id)).not.toContain(track.id);
  });
});

describe('гейт видимости в ленте', () => {
  it('в свежие кандидаты не попадают релизы скрытого артиста и черновики', async () => {
    const { artist, release: published } = await makeVisibleArtist();

    const hidden = await makeArtist({ isActive: false });
    const hiddenRelease = await makeRelease(hidden.id);
    await makeTrack(hiddenRelease.id);

    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    await makeTrack(draft.id);

    const ids = (await getFreshFeedCandidates([], 50)).map((c) => c.id);
    expect(ids).toContain(published.id);
    expect(ids).not.toContain(hiddenRelease.id);
    expect(ids).not.toContain(draft.id);
  });

  it('excludeReleaseIds исключает уже показанное', async () => {
    const { release } = await makeVisibleArtist();

    expect((await getFreshFeedCandidates([], 50)).map((c) => c.id)).toContain(release.id);
    const rest = await getFreshFeedCandidates([release.id], 50);
    expect(rest.map((c) => c.id)).not.toContain(release.id);
  });
});
