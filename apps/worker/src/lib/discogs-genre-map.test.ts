import { describe, it, expect } from 'vitest';
import { DISCOGS_400_LABELS } from './discogs-genre-labels.js';
import { DISCOGS_TO_GENRE, DROPPED_LABELS, mapDiscogsPredictionsToGenres } from './discogs-genre-map.js';

function zeros(): Float64Array {
  return new Float64Array(DISCOGS_400_LABELS.length);
}

function labelIndex(label: string): number {
  const i = DISCOGS_400_LABELS.indexOf(label);
  if (i === -1) throw new Error(`метка не найдена: ${label}`);
  return i;
}

describe('DISCOGS_TO_GENRE + DROPPED_LABELS', () => {
  it('содержит ровно 400 меток в исходном списке модели', () => {
    expect(DISCOGS_400_LABELS.length).toBe(400);
  });

  it('каждая метка ровно в одном из {DISCOGS_TO_GENRE, DROPPED_LABELS}, сумма = 400', () => {
    for (const label of DISCOGS_400_LABELS) {
      const mapped = label in DISCOGS_TO_GENRE;
      const dropped = DROPPED_LABELS.has(label);
      expect(mapped !== dropped, `метка "${label}" должна быть ровно в одном месте`).toBe(true);
    }
    expect(Object.keys(DISCOGS_TO_GENRE).length + DROPPED_LABELS.size).toBe(400);
  });

  it('каждая метка маппинга и DROPPED_LABELS реально существует в списке модели', () => {
    const known = new Set(DISCOGS_400_LABELS);
    for (const label of Object.keys(DISCOGS_TO_GENRE)) {
      expect(known.has(label), label).toBe(true);
    }
    for (const label of DROPPED_LABELS) {
      expect(known.has(label), label).toBe(true);
    }
  });

  it('маппит устоявшиеся лейблы в существующие жанры', () => {
    expect(DISCOGS_TO_GENRE['Electronic---Ambient']).toBe('AMBIENT');
    expect(DISCOGS_TO_GENRE['Electronic---Techno']).toBe('TECHNO');
    expect(DISCOGS_TO_GENRE['Electronic---House']).toBe('HOUSE');
    expect(DISCOGS_TO_GENRE['Electronic---Trance']).toBe('TRANCE');
    expect(DISCOGS_TO_GENRE['Electronic---Drum n Bass']).toBe('DNB');
    expect(DISCOGS_TO_GENRE['Electronic---UK Garage']).toBe('GARAGE');
    expect(DISCOGS_TO_GENRE['Electronic---Synth-pop']).toBe('SYNTHPOP');
    expect(DISCOGS_TO_GENRE['Rock---Indie Rock']).toBe('INDIE');
    expect(DISCOGS_TO_GENRE['Rock---Heavy Metal']).toBe('HEAVYMETAL');
    expect(DISCOGS_TO_GENRE['Rock---Psychedelic Rock']).toBe('PSYCHEDELIC');
    expect(DISCOGS_TO_GENRE['Rock---Doom Metal']).toBe('DOOM');
    expect(DISCOGS_TO_GENRE['Rock---Lo-Fi']).toBe('LOFI');
    expect(DISCOGS_TO_GENRE['Hip Hop---Trap']).toBe('TRAP');
    expect(DISCOGS_TO_GENRE['Jazz---Bop']).toBe('BEBOP');
  });

  it('маппит точечные сабжанры в новые значения 1:1', () => {
    expect(DISCOGS_TO_GENRE['Electronic---Deep House']).toBe('DEEP_HOUSE');
    expect(DISCOGS_TO_GENRE['Electronic---Jungle']).toBe('JUNGLE');
    expect(DISCOGS_TO_GENRE['Electronic---Vaporwave']).toBe('VAPORWAVE');
    expect(DISCOGS_TO_GENRE['Hip Hop---Gangsta']).toBe('GANGSTA');
    expect(DISCOGS_TO_GENRE['Funk / Soul---P.Funk']).toBe('P_FUNK');
    expect(DISCOGS_TO_GENRE['Pop---K-pop']).toBe('K_POP');
    expect(DISCOGS_TO_GENRE['Latin---Reggaeton']).toBe('REGGAETON');
    expect(DISCOGS_TO_GENRE['Rock---Thrash']).toBe('THRASH');
    expect(DISCOGS_TO_GENRE['Classical---Baroque']).toBe('BAROQUE');
    expect(DISCOGS_TO_GENRE['Folk, World, & Country---Séga']).toBe('SEGA');
  });

  it('одноимённые стили под разными родителями сведены в один жанр', () => {
    expect(DISCOGS_TO_GENRE['Electronic---Grime']).toBe('GRIME');
    expect(DISCOGS_TO_GENRE['Hip Hop---Grime']).toBe('GRIME');
    expect(DISCOGS_TO_GENRE['Electronic---Trip Hop']).toBe('TRIP_HOP');
    expect(DISCOGS_TO_GENRE['Hip Hop---Trip Hop']).toBe('TRIP_HOP');
    expect(DISCOGS_TO_GENRE['Electronic---Disco']).toBe('DISCO');
    expect(DISCOGS_TO_GENRE['Funk / Soul---Disco']).toBe('DISCO');
    expect(DISCOGS_TO_GENRE['Electronic---Modern Classical']).toBe('MODERN_CLASSICAL');
    expect(DISCOGS_TO_GENRE['Classical---Modern']).toBe('MODERN_CLASSICAL');
    expect(DISCOGS_TO_GENRE['Reggae---Ska']).toBe('SKA');
    expect(DISCOGS_TO_GENRE['Rock---Ska']).toBe('SKA');
  });

  it('разные по смыслу одноимённые стили разведены', () => {
    expect(DISCOGS_TO_GENRE['Electronic---Hardcore']).toBe('HARDCORE_EDM');
    expect(DISCOGS_TO_GENRE['Rock---Hardcore']).toBe('HARDCORE_PUNK');
    expect(DISCOGS_TO_GENRE['Funk / Soul---Psychedelic']).toBe('PSYCHEDELIC_SOUL');
  });

  it('гор/порно-грайнд сведены в общий GRINDCORE, Brass & Military — в BRASS', () => {
    expect(DISCOGS_TO_GENRE['Rock---Goregrind']).toBe('GRINDCORE');
    expect(DISCOGS_TO_GENRE['Rock---Pornogrind']).toBe('GRINDCORE');
    expect(DISCOGS_TO_GENRE['Rock---Grindcore']).toBe('GRINDCORE');
    expect(DISCOGS_TO_GENRE['Brass & Military---Brass Band']).toBe('BRASS');
    expect(DISCOGS_TO_GENRE['Brass & Military---Marches']).toBe('BRASS');
    expect(DISCOGS_TO_GENRE['Brass & Military---Military']).toBe('BRASS');
  });

  it('Non-Music: Poetry/Spoken Word → SPOKENWORD, Field Recording → FIELD_RECORDING', () => {
    expect(DISCOGS_TO_GENRE['Non-Music---Poetry']).toBe('SPOKENWORD');
    expect(DISCOGS_TO_GENRE['Non-Music---Spoken Word']).toBe('SPOKENWORD');
    expect(DISCOGS_TO_GENRE['Non-Music---Field Recording']).toBe('FIELD_RECORDING');
  });

  it('Stage & Screen---Score маппится в CINEMATIC (не SOUNDTRACK)', () => {
    expect(DISCOGS_TO_GENRE['Stage & Screen---Score']).toBe('CINEMATIC');
  });
});

describe('mapDiscogsPredictionsToGenres', () => {
  it('отбрасывает dropped-метки и не учитывает их в нормализации', () => {
    const probs = zeros();
    probs[labelIndex('Electronic---Ambient')] = 0.8; // -> AMBIENT
    probs[labelIndex("Children's---Story")] = 0.9; // в DROPPED_LABELS — отбрасывается

    const result = mapDiscogsPredictionsToGenres(probs);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ genre: 'AMBIENT', confidence: 1 });
  });

  it('суммирует confidence нескольких меток, попавших в один наш жанр', () => {
    const probs = zeros();
    probs[labelIndex('Brass & Military---Brass Band')] = 0.3;
    probs[labelIndex('Brass & Military---Marches')] = 0.2;
    probs[labelIndex('Brass & Military---Military')] = 0.1;

    const result = mapDiscogsPredictionsToGenres(probs);
    expect(result).toHaveLength(1);
    expect(result[0].genre).toBe('BRASS');
    expect(result[0].confidence).toBeCloseTo(1, 5);
  });

  it('возвращает топ-5, отсортированные по убыванию confidence', () => {
    const probs = zeros();
    probs[labelIndex('Electronic---Techno')] = 0.5;
    probs[labelIndex('Electronic---House')] = 0.3;
    probs[labelIndex('Electronic---Trance')] = 0.2;
    probs[labelIndex('Electronic---Dubstep')] = 0.15;
    probs[labelIndex('Electronic---IDM')] = 0.1;
    probs[labelIndex('Electronic---Drum n Bass')] = 0.05;

    const result = mapDiscogsPredictionsToGenres(probs);
    expect(result).toHaveLength(5);
    expect(result[0].genre).toBe('TECHNO');
    expect(result[1].genre).toBe('HOUSE');
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });

  it('пустой ввод (все нули) даёт пустой результат', () => {
    expect(mapDiscogsPredictionsToGenres(zeros())).toEqual([]);
  });

  it('жанр с одним сильным лейблом обходит жанр с диффузной массой из многих меток', () => {
    const probs = zeros();
    // 4 метки RNB по 0.1 (сумма 0.4) против одной метки NEOSOUL 0.35 —
    // при чистой сумме первым был бы RNB (0.40 > 0.35).
    const rnbLabels = [
      'Blues---Rhythm & Blues', 'Funk / Soul---Contemporary R&B',
      'Funk / Soul---Rhythm & Blues', 'Hip Hop---RnB/Swing',
    ];
    for (const label of rnbLabels) probs[labelIndex(label)] = 0.1;
    probs[labelIndex('Funk / Soul---Neo Soul')] = 0.35;

    const result = mapDiscogsPredictionsToGenres(probs);
    expect(result[0].genre).toBe('NEOSOUL');
    expect(result.find((r) => r.genre === 'RNB')?.confidence ?? 0).toBeLessThan(
      result[0].confidence,
    );
  });

  it('confidence нормированы на сумму score по всем замэпленным жанрам', () => {
    const probs = zeros();
    probs[labelIndex('Electronic---Techno')] = 0.5;
    probs[labelIndex('Electronic---House')] = 0.3;
    probs[labelIndex('Electronic---Deep House')] = 0.1;
    probs[labelIndex('Electronic---Trance')] = 0.2;

    const result = mapDiscogsPredictionsToGenres(probs);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
    const sumOfShares = result.reduce((acc, r) => acc + r.confidence, 0);
    // Топ-5 не обязан покрывать всю массу, но здесь замэплено ровно 4 жанра
    // (TECHNO, HOUSE, DEEP_HOUSE, TRANCE) — сумма confidence должна давать 1.
    expect(result).toHaveLength(4);
    expect(sumOfShares).toBeCloseTo(1, 5);
  });
});
