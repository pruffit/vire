import { describe, it, expect, beforeEach } from 'vitest';
import { getPublicTrackLyrics } from '../lyrics';
import { getTrackAudio, getPlayableTrackAudio } from '../track-audio';
import { getGenreCounts } from '../track-genres';
import { getMoodCounts } from '../track-moods';
import {
  resetDb,
  makeArtist,
  makeRelease,
  makeTrack,
  makeVisibleArtist,
  addTrackAudio,
  addTrackGenres,
  addTrackMoods,
} from './db-harness';

beforeEach(resetDb);

const LRC = [{ timeMs: 0, text: 'первая строка' }];

describe('гейт видимости текста песни', () => {
  it('текст отдаётся только для опубликованного релиза', async () => {
    const artist = await makeArtist();
    const published = await makeRelease(artist.id, { status: 'PUBLISHED' });
    const openTrack = await makeTrack(published.id, { lyrics: LRC });
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id, { lyrics: LRC });

    expect(await getPublicTrackLyrics(openTrack.id)).toEqual(LRC);
    expect(await getPublicTrackLyrics(draftTrack.id)).toBeNull();
  });

  it('трек без текста отдаёт null, а не пустой массив', async () => {
    const { track } = await makeVisibleArtist();
    expect(await getPublicTrackLyrics(track.id)).toBeNull();
  });
});

describe('гейт видимости аудио трека', () => {
  it('getPlayableTrackAudio молчит про черновик, скрытого артиста и не-READY', async () => {
    const { artist, track: playable } = await makeVisibleArtist();
    await addTrackAudio(playable.id);
    expect(await getPlayableTrackAudio(playable.id)).not.toBeNull();

    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id);
    await addTrackAudio(draftTrack.id);
    expect(await getPlayableTrackAudio(draftTrack.id)).toBeNull();

    const published = await makeRelease(artist.id);
    const processing = await makeTrack(published.id, { status: 'PROCESSING' });
    await addTrackAudio(processing.id);
    expect(await getPlayableTrackAudio(processing.id)).toBeNull();

    const hidden = await makeArtist({ isActive: false });
    const hiddenRelease = await makeRelease(hidden.id);
    const hiddenTrack = await makeTrack(hiddenRelease.id);
    await addTrackAudio(hiddenTrack.id);
    expect(await getPlayableTrackAudio(hiddenTrack.id)).toBeNull();
  });

  it('getTrackAudio гейта не несёт — это путь дашборда и админки', async () => {
    const artist = await makeArtist();
    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id, { status: 'PROCESSING' });
    await addTrackAudio(draftTrack.id, { bpm: 128 });

    // Зафиксировано намеренно: владелец должен видеть характеристики своего черновика,
    // публичный путь идёт через getPlayableTrackAudio выше.
    const audio = await getTrackAudio(draftTrack.id);
    expect(audio).not.toBeNull();
    expect(audio!.bpm).toBe(128);
  });
});

describe('счётчики жанров и настроений', () => {
  it('считают только READY-треки вышедших релизов активных артистов', async () => {
    const { artist, track: playable } = await makeVisibleArtist();
    await addTrackGenres(playable.id, ['AMBIENT']);
    await addTrackMoods(playable.id, ['AMBIENT']);

    const draft = await makeRelease(artist.id, { status: 'DRAFT' });
    const draftTrack = await makeTrack(draft.id);
    await addTrackGenres(draftTrack.id, ['AMBIENT']);
    await addTrackMoods(draftTrack.id, ['AMBIENT']);

    const hidden = await makeArtist({ isActive: false });
    const hiddenRelease = await makeRelease(hidden.id);
    const hiddenTrack = await makeTrack(hiddenRelease.id);
    await addTrackGenres(hiddenTrack.id, ['AMBIENT']);
    await addTrackMoods(hiddenTrack.id, ['AMBIENT']);

    const genres = await getGenreCounts();
    expect(genres.find((g) => g.genre === 'AMBIENT')?.count).toBe(1);

    const moods = await getMoodCounts();
    expect(moods.find((m) => m.mood === 'AMBIENT')?.count).toBe(1);
  });
});
