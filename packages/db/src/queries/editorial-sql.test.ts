import { describe, it, expect, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

vi.mock('../client', () => ({ db: {} }));

const { staleMoodPlaylistWhere } = await import('./editorial');
const { editorialPlaylistIdentity } = await import('./playlist-editorial');

const dialect = new PgDialect();

describe('staleMoodPlaylistWhere', () => {
  it('OR не вырывается за пределы and() — иначе прогон снёс бы чужие подборки', () => {
    const { sql } = dialect.sqlToQuery(staleMoodPlaylistWhere(['CHILL', 'NIGHT']));
    // хвост условия — закрытая скобка OR-группы, а не голый второй операнд
    expect(sql).toMatch(/and \(\("playlists"\."editorial_params"->>'mood'\) IS NULL OR .+\)\)$/);
  });

  it('всегда сужен до общих MOOD-подборок', () => {
    const { sql } = dialect.sqlToQuery(staleMoodPlaylistWhere(['CHILL']));
    expect(sql).toContain('"playlists"."is_curated" =');
    expect(sql).toContain('"playlists"."kind" =');
    expect(sql).toContain('"playlists"."target_user_id" IS NULL');
  });

  it('пустой keep — сносит все общие mood-подборки', () => {
    const { sql } = dialect.sqlToQuery(staleMoodPlaylistWhere([]));
    expect(sql).toContain('true');
    expect(sql).not.toContain('OR');
  });

  it('настроения уходят bind-параметрами в text[], не конкатенацией в строку', () => {
    const { sql, params } = dialect.sqlToQuery(staleMoodPlaylistWhere(['CHILL', 'NIGHT']));
    expect(sql).toContain('::text[]');
    expect(sql).not.toContain('CHILL');
    expect(params).toEqual(expect.arrayContaining(['CHILL', 'NIGHT']));
  });
});

describe('editorialPlaylistIdentity', () => {
  it('mood-подборка ловится и по params, и по заголовку легаси-строки без params', () => {
    const { sql, params } = dialect.sqlToQuery(editorialPlaylistIdentity({ mood: 'CHILL' }, 'Расслабон'));
    expect(sql).toMatch(/^\(.+\)$/);
    expect(sql).toContain("->>'mood' =");
    expect(sql).toContain('"playlists"."editorial_params" IS NULL AND "playlists"."title" =');
    expect(params).toEqual(['CHILL', 'Расслабон']);
  });

  it('подборка без params (trending/fresh/relisten) — только по отсутствию params', () => {
    const { sql, params } = dialect.sqlToQuery(editorialPlaylistIdentity(undefined, 'Свежее'));
    expect(sql).toBe('"playlists"."editorial_params" IS NULL');
    expect(params).toEqual([]);
  });
});
