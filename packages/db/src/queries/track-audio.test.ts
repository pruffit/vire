import { describe, it, expect, vi, beforeEach } from 'vitest';

// Раздельные таймстемпы готовности (bpmKeyAnalyzedAt/genreAnalyzedAt) — фикс гонки
// поллинга: обе джобы анализа раньше бампали общий updatedAt, из-за чего финиш
// любой из них триггерил «готово» у обоих хуков поллинга. Тесты бьют по месту
// самого фикса — записи/чтению этих полей в запросах.
const h = vi.hoisted(() => ({
  setMock: vi.fn().mockReturnThis(),
  whereMock: vi.fn().mockResolvedValue(undefined),
  selectRow: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../client', () => ({
  db: {
    update: vi.fn(() => ({ set: h.setMock, where: h.whereMock })),
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve(h.selectRow ? [h.selectRow] : [])),
    })),
  },
}));

import { updateTrackAnalysis, saveGenreSuggestions, getAudioFeaturesSnapshot, getGenreSuggestionsSnapshot } from './track-audio';

const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';

beforeEach(() => {
  vi.clearAllMocks();
  h.setMock.mockReturnThis();
  h.selectRow = undefined;
});

describe('updateTrackAnalysis', () => {
  it('stamps bpmKeyAnalyzedAt alongside the general updatedAt', async () => {
    await updateTrackAnalysis(TRACK_ID, 128, 'Am');
    const patch = h.setMock.mock.calls[0][0];
    expect(patch.bpm).toBe(128);
    expect(patch.musicalKey).toBe('Am');
    expect(patch.bpmKeyAnalyzedAt).toBeInstanceOf(Date);
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });
});

describe('saveGenreSuggestions', () => {
  it('stamps genreAnalyzedAt alongside the general updatedAt', async () => {
    const suggestions = [{ genre: 'TECHNO', confidence: 0.8 }];
    await saveGenreSuggestions(TRACK_ID, suggestions);
    const patch = h.setMock.mock.calls[0][0];
    expect(patch.genreSuggestions).toBe(suggestions);
    expect(patch.genreAnalyzedAt).toBeInstanceOf(Date);
    expect(patch.updatedAt).toBeInstanceOf(Date);
  });
});

describe('getAudioFeaturesSnapshot', () => {
  it('reports updatedAt from bpmKeyAnalyzedAt, not the general updatedAt', async () => {
    h.selectRow = {
      bpm: 90,
      musicalKey: 'Cm',
      bpmKeyAnalyzedAt: new Date('2026-07-01T00:00:00.000Z'),
    };
    const snapshot = await getAudioFeaturesSnapshot(TRACK_ID);
    expect(snapshot.updatedAt).toBe('2026-07-01T00:00:00.000Z');
  });

  it('is null when the track has never been analyzed', async () => {
    h.selectRow = { bpm: null, musicalKey: null, bpmKeyAnalyzedAt: null };
    const snapshot = await getAudioFeaturesSnapshot(TRACK_ID);
    expect(snapshot.updatedAt).toBeNull();
  });
});

describe('getGenreSuggestionsSnapshot', () => {
  it('reports updatedAt from genreAnalyzedAt, not the general updatedAt', async () => {
    h.selectRow = {
      genreSuggestions: [{ genre: 'AMBIENT', confidence: 0.5 }],
      genreAnalyzedAt: new Date('2026-07-02T00:00:00.000Z'),
    };
    const snapshot = await getGenreSuggestionsSnapshot(TRACK_ID);
    expect(snapshot.updatedAt).toBe('2026-07-02T00:00:00.000Z');
  });

  it('is null when the track has never been analyzed', async () => {
    h.selectRow = { genreSuggestions: null, genreAnalyzedAt: null };
    const snapshot = await getGenreSuggestionsSnapshot(TRACK_ID);
    expect(snapshot.updatedAt).toBeNull();
  });
});
