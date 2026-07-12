import { describe, it, expect, vi } from 'vitest';
import { sql, type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../client', () => ({ db: {} }));

import { waveOrderBy } from './wave';
import type { TrackGenre } from './track-genres';

const dialect = new PgDialect();
const render = (chunks: SQL[]) => dialect.sqlToQuery(sql.join(chunks, sql`, `)).sql;

describe('waveOrderBy', () => {
  const score = sql<number>`1.0`;

  it('без жанра не добавляет позиционную константу в ORDER BY', () => {
    const terms = waveOrderBy(null, score);
    expect(terms).toHaveLength(1);
    const rendered = render(terms);
    expect(rendered).not.toMatch(/(?:^|[\s,(])\d+ DESC/);
  });

  it('с жанром добавляет CASE-ярус перед score', () => {
    const terms = waveOrderBy('HIPHOP' as TrackGenre, score);
    expect(terms).toHaveLength(2);
    const [tier, scoreTerm] = terms;
    expect(render([tier])).toMatch(/CASE/);
    expect(render([scoreTerm])).toMatch(/1\.0/);
  });
});
