import { describe, it, expect, beforeEach } from 'vitest';
import { getWaveTracks, type WaveScoringParams } from '../wave';
import { resetDb, makeVisibleArtist, makeRelease, makeTrack, addTrackGenres, addTrackMoods } from './db-harness';

beforeEach(resetDb);

const base: WaveScoringParams = {
  currentTrackId: null,
  excludeIds: [],
  limit: 5,
  seedMood: null,
  seedGenre: null,
  sessionMood: null,
  sessionGenre: null,
  taste: null,
  keySets: null,
  recentArtistIds: [],
  userId: null,
};

/** Пять играбельных треков у одного артиста — минимальная выборка, на которой видно клэмп и фильтры. */
async function seedTracks(count: number): Promise<string[]> {
  const { artist, track: first } = await makeVisibleArtist();
  const release = await makeRelease(artist.id);
  const ids = [first.id];
  for (let i = 1; i < count; i++) {
    const track = await makeTrack(release.id, { trackNumber: i + 1, title: `Трек ${i + 1}` });
    ids.push(track.id);
  }
  return ids;
}

describe('размер пачки волны', () => {
  it('лимит зажат сверху пятёркой', async () => {
    await seedTracks(8);
    expect((await getWaveTracks({ ...base, limit: 50 })).length).toBe(5);
  });

  it('лимит зажат снизу единицей', async () => {
    await seedTracks(3);
    expect((await getWaveTracks({ ...base, limit: 0 })).length).toBe(1);
  });
});

describe('seed волны фильтрует, а не подмешивает вес', () => {
  it('seedMood оставляет только треки с этим настроением', async () => {
    const ids = await seedTracks(3);
    await addTrackMoods(ids[0]!, ['NIGHT']);
    await addTrackMoods(ids[1]!, ['DRIVE']);

    const got = (await getWaveTracks({ ...base, seedMood: 'NIGHT' })).map((t) => t.id);
    expect(got).toEqual([ids[0]!]);
  });

  it('seedGenre расширяется до семейства — соседний поджанр тоже попадает', async () => {
    const ids = await seedTracks(3);
    await addTrackGenres(ids[0]!, ['TECHNO']);
    await addTrackGenres(ids[1]!, ['MINIMAL']);
    await addTrackGenres(ids[2]!, ['HOUSE']);

    const got = (await getWaveTracks({ ...base, seedGenre: 'TECHNO', limit: 5 })).map((t) => t.id);
    expect(got).toContain(ids[0]!);
    // MINIMAL из того же семейства techno — попадает, хотя жанр запрошен другой.
    expect(got).toContain(ids[1]!);
    // HOUSE — другое семейство.
    expect(got).not.toContain(ids[2]!);
  });

  it('без seed отдаются треки любых настроений', async () => {
    const ids = await seedTracks(2);
    await addTrackMoods(ids[0]!, ['NIGHT']);
    await addTrackMoods(ids[1]!, ['DRIVE']);

    const got = (await getWaveTracks({ ...base })).map((t) => t.id);
    expect(got).toHaveLength(2);
  });
});
