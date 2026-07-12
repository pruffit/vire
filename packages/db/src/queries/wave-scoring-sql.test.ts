import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../client', () => ({ db: {} }));

const { waveSkipPenaltyFor, qualityScore } = await import('./wave');

describe('waveSkipPenaltyFor', () => {
  const dialect = new PgDialect();

  it('для анонима — константа 0', () => {
    const q = dialect.sqlToQuery(waveSkipPenaltyFor(null));
    expect(q.sql.trim()).toBe('0');
  });

  it('для юзера — exists по source=wave с порогом и окном из core', () => {
    const q = dialect.sqlToQuery(waveSkipPenaltyFor('00000000-0000-0000-0000-000000000001'));
    expect(q.sql).toContain(`pw.source = 'wave'`);
    expect(q.sql).toContain(`interval '30 days'`);
    expect(q.sql).toContain('< 0.3');
    expect(q.sql).toContain('-0.4');
  });
});

describe('qualityScore', () => {
  const dialect = new PgDialect();
  const q = dialect.sqlToQuery(qualityScore);

  it('веса источников — литералы из core, не bind-параметры', () => {
    expect(q.params).toEqual([]);
    expect(q.sql).toContain(`WHEN 'wave' THEN 1`);
    expect(q.sql).toContain(`WHEN 'playlist' THEN 0.6`);
    expect(q.sql).toContain(`WHEN 'liked' THEN 0.6`);
    expect(q.sql).toContain(`WHEN 'purchased' THEN 0.6`);
    expect(q.sql).toContain('ELSE 0.8 END');
  });

  it('взвешенное среднее: доля ≤ 1, защита от деления на 0, окно 90 дней, вес терма 0.3', () => {
    expect(q.sql).toContain('LEAST(1.0, pe.duration_played_sec::float / NULLIF(tracks.duration_sec, 0))');
    expect(q.sql).toMatch(/\/ NULLIF\(SUM\(CASE pe\.source/);
    expect(q.sql).toContain(`interval '90 days'`);
    expect(q.sql).toContain('* 0.3');
    expect(q.sql).toMatch(/^COALESCE\(/);
  });
});
