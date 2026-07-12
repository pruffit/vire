import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../client', () => ({ db: {} }));

const { waveSkipPenaltyFor } = await import('./wave');

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
