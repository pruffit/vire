import { describe, it, expect } from 'vitest';
import { DISCOGS_400_LABELS } from './discogs-genre-labels.js';
import { DISCOGS_TO_GENRE, mapDiscogsPredictionsToGenres } from './discogs-genre-map.js';

function zeros(): Float64Array {
  return new Float64Array(DISCOGS_400_LABELS.length);
}

function labelIndex(label: string): number {
  const i = DISCOGS_400_LABELS.indexOf(label);
  if (i === -1) throw new Error(`метка не найдена: ${label}`);
  return i;
}

describe('DISCOGS_TO_GENRE', () => {
  it('содержит ровно 400 меток в исходном списке модели', () => {
    expect(DISCOGS_400_LABELS.length).toBe(400);
  });

  it('маппит известные точечные лейблы в ожидаемые жанры', () => {
    expect(DISCOGS_TO_GENRE['Electronic---Ambient']).toBe('AMBIENT');
    expect(DISCOGS_TO_GENRE['Electronic---Techno']).toBe('TECHNO');
    expect(DISCOGS_TO_GENRE['Electronic---House']).toBe('HOUSE');
    expect(DISCOGS_TO_GENRE['Electronic---Trance']).toBe('TRANCE');
    expect(DISCOGS_TO_GENRE['Electronic---Drum n Bass']).toBe('DNB');
    expect(DISCOGS_TO_GENRE['Electronic---Dubstep']).toBe('DUBSTEP');
    expect(DISCOGS_TO_GENRE['Electronic---IDM']).toBe('IDM');
    expect(DISCOGS_TO_GENRE['Electronic---Synth-pop']).toBe('SYNTHPOP');
    expect(DISCOGS_TO_GENRE['Rock---Indie Rock']).toBe('INDIE');
    expect(DISCOGS_TO_GENRE['Rock---Heavy Metal']).toBe('HEAVYMETAL');
    expect(DISCOGS_TO_GENRE['Rock---Punk']).toBe('PUNK');
    expect(DISCOGS_TO_GENRE['Hip Hop---Trap']).toBe('TRAP');
    expect(DISCOGS_TO_GENRE['Rock---Lo-Fi']).toBe('LOFI');
  });

  it('маппит новые дозаполненные метки', () => {
    expect(DISCOGS_TO_GENRE['Electronic---Chiptune']).toBe('ELECTRONIC');
    expect(DISCOGS_TO_GENRE['Electronic---Beatdown']).toBe('HOUSE');
    expect(DISCOGS_TO_GENRE['Electronic---Donk']).toBe('HARDSTYLE');
    expect(DISCOGS_TO_GENRE['Electronic---Ghetto']).toBe('HOUSE');
    expect(DISCOGS_TO_GENRE['Electronic---Disco Polo']).toBe('POP');
    expect(DISCOGS_TO_GENRE['Hip Hop---Bass Music']).toBe('HIPHOP');
    expect(DISCOGS_TO_GENRE['Jazz---Space-Age']).toBe('JAZZ');
  });

  it('Stage & Screen---Score маппится в CINEMATIC (не SOUNDTRACK)', () => {
    expect(DISCOGS_TO_GENRE['Stage & Screen---Score']).toBe('CINEMATIC');
  });

  it('каждая метка маппинга реально существует в списке модели (нет опечаток)', () => {
    const known = new Set(DISCOGS_400_LABELS);
    for (const label of Object.keys(DISCOGS_TO_GENRE)) {
      expect(known.has(label)).toBe(true);
    }
  });
});

describe('mapDiscogsPredictionsToGenres', () => {
  it('отбрасывает неизвестные метки и не учитывает их в нормализации', () => {
    const probs = zeros();
    probs[labelIndex('Electronic---Ambient')] = 0.8; // -> AMBIENT
    probs[labelIndex("Children's---Story")] = 0.9; // нет маппинга — отбрасывается

    const result = mapDiscogsPredictionsToGenres(probs);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ genre: 'AMBIENT', confidence: 1 });
  });

  it('суммирует confidence нескольких меток, попавших в один наш жанр', () => {
    const probs = zeros();
    probs[labelIndex('Electronic---House')] = 0.3;
    probs[labelIndex('Electronic---Deep House')] = 0.2;
    probs[labelIndex('Electronic---Tech House')] = 0.1;

    const result = mapDiscogsPredictionsToGenres(probs);
    expect(result).toHaveLength(1);
    expect(result[0].genre).toBe('HOUSE');
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

  it('точный жанр с одним сильным лейблом обходит зонтичный с диффузной массой', () => {
    const probs = zeros();
    // 20 меток HIPHOP по 0.02 (сумма 0.4) против одной метки TRAP 0.35 —
    // при старой чистой сумме первым был бы HIPHOP (0.40 > 0.35).
    const hiphopLabels = [
      'Hip Hop---Bounce', 'Hip Hop---Britcore', 'Hip Hop---Conscious', 'Hip Hop---Crunk',
      'Hip Hop---Cut-up/DJ', 'Hip Hop---Electro', 'Hip Hop---G-Funk', 'Hip Hop---Gangsta',
      'Hip Hop---Grime', 'Hip Hop---Hardcore Hip-Hop', 'Hip Hop---Horrorcore',
      'Hip Hop---Instrumental', 'Hip Hop---Jazzy Hip-Hop', 'Hip Hop---Miami Bass',
      'Hip Hop---Pop Rap', 'Hip Hop---Ragga HipHop', 'Hip Hop---Screw', 'Hip Hop---Thug Rap',
      'Hip Hop---Turntablism', 'Electronic---Hip Hop',
    ];
    expect(hiphopLabels).toHaveLength(20);
    for (const label of hiphopLabels) probs[labelIndex(label)] = 0.02;
    probs[labelIndex('Hip Hop---Trap')] = 0.35;

    const result = mapDiscogsPredictionsToGenres(probs);
    expect(result[0].genre).toBe('TRAP');
    expect(result.find((r) => r.genre === 'HIPHOP')?.confidence ?? 0).toBeLessThan(
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
    // Топ-5 не обязан покрывать всю массу, но здесь замэплено ровно 3 жанра —
    // сумма confidence всех возвращённых жанров должна давать 1.
    expect(sumOfShares).toBeCloseTo(1, 5);
  });
});
