import { describe, it, expect } from 'vitest';
import { ok, err, NotFoundError, ConflictError } from '../errors';

describe('ok', () => {
  it('returns ok result with value', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it('works with null', () => {
    const result = ok(null);
    expect(result.ok).toBe(true);
    expect(result.value).toBeNull();
  });

  it('works with object', () => {
    const value = { id: '1', name: 'Test' };
    const result = ok(value);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(value);
  });
});

describe('err', () => {
  it('returns err result with error', () => {
    const error = new Error('something failed');
    const result = err(error);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(error);
  });

  it('works with string error', () => {
    const result = err('bad input');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('bad input');
  });
});

describe('NotFoundError', () => {
  it('sets correct message', () => {
    const error = new NotFoundError('ArtistProfile', 'my-slug');
    expect(error.message).toBe('ArtistProfile not found: my-slug');
  });

  it('has _tag discriminant', () => {
    const error = new NotFoundError('Release', 'r1');
    expect(error._tag).toBe('NotFoundError');
  });

  it('has correct name', () => {
    const error = new NotFoundError('Track', 't1');
    expect(error.name).toBe('NotFoundError');
  });

  it('is instanceof Error', () => {
    const error = new NotFoundError('X', 'y');
    expect(error).toBeInstanceOf(Error);
  });

  it('exposes the resource it was constructed with', () => {
    expect(new NotFoundError('Track', 't1').resource).toBe('Track');
    expect(new NotFoundError('Playlist', 'p1').resource).toBe('Playlist');
    expect(new NotFoundError('SomeArbitraryThing', 'x').resource).toBe('SomeArbitraryThing');
  });
});

describe('ConflictError', () => {
  it('sets correct message', () => {
    const error = new ConflictError('Playlist reorder', 'p1');
    expect(error.message).toBe('Playlist reorder conflict: p1');
  });

  it('has _tag discriminant', () => {
    const error = new ConflictError('Playlist reorder', 'p1');
    expect(error._tag).toBe('ConflictError');
  });

  it('has correct name', () => {
    const error = new ConflictError('Playlist reorder', 'p1');
    expect(error.name).toBe('ConflictError');
  });

  it('is instanceof Error', () => {
    const error = new ConflictError('X', 'y');
    expect(error).toBeInstanceOf(Error);
  });
});
