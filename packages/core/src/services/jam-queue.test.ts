import { describe, it, expect } from 'vitest';
import { applyQueueMutation, type QueueMutation } from './jam-queue';
import type { JamQueueItemWrite } from '../repositories/jam';

const ADDED_AT = new Date('2026-07-20T12:00:00Z');

const item = (id: string, overrides?: Partial<JamQueueItemWrite>): JamQueueItemWrite => ({
  id,
  trackId: `track-${id}`,
  addedByParticipantId: 'p1',
  addedAt: ADDED_AT,
  ...overrides,
});

describe('applyQueueMutation — add', () => {
  it('appends a new item without an id, at the end', () => {
    const items = [item('a'), item('b')];
    const mutation: QueueMutation = { kind: 'add', trackId: 'track-new', participantId: 'p2', addedAt: ADDED_AT };

    const result = applyQueueMutation(items, mutation);

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ trackId: 'track-new', addedByParticipantId: 'p2', addedAt: ADDED_AT });
    expect('id' in result[2]!).toBe(false);
  });

  it('preserves existing items and their ids unchanged', () => {
    const items = [item('a'), item('b')];
    const mutation: QueueMutation = { kind: 'add', trackId: 'track-new', participantId: 'p2', addedAt: ADDED_AT };

    const result = applyQueueMutation(items, mutation);

    expect(result[0]).toEqual(items[0]);
    expect(result[1]).toEqual(items[1]);
  });

  it('adding into an empty queue produces a single item at index 0', () => {
    const result = applyQueueMutation([], { kind: 'add', trackId: 't1', participantId: 'p1', addedAt: ADDED_AT });
    expect(result).toHaveLength(1);
    expect(result[0]!.trackId).toBe('t1');
  });

  it('does not mutate the input array', () => {
    const items = [item('a')];
    const snapshot = [...items];
    applyQueueMutation(items, { kind: 'add', trackId: 't2', participantId: 'p1', addedAt: ADDED_AT });
    expect(items).toEqual(snapshot);
  });
});

describe('applyQueueMutation — remove', () => {
  it('removes the matching item and reindexes the rest', () => {
    const items = [item('a'), item('b'), item('c')];
    const result = applyQueueMutation(items, { kind: 'remove', itemId: 'b' });
    expect(result.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('is a no-op returning the original array when itemId does not exist', () => {
    const items = [item('a'), item('b')];
    const result = applyQueueMutation(items, { kind: 'remove', itemId: 'ghost' });
    expect(result).toBe(items);
  });

  it('removing from a single-item queue leaves it empty', () => {
    const items = [item('a')];
    const result = applyQueueMutation(items, { kind: 'remove', itemId: 'a' });
    expect(result).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = [item('a'), item('b')];
    const snapshot = [...items];
    applyQueueMutation(items, { kind: 'remove', itemId: 'a' });
    expect(items).toEqual(snapshot);
  });
});

describe('applyQueueMutation — move', () => {
  it('moves an item to a middle position', () => {
    const items = [item('a'), item('b'), item('c'), item('d')];
    const result = applyQueueMutation(items, { kind: 'move', itemId: 'a', toPosition: 2 });
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('clamps an out-of-range positive toPosition to the last index', () => {
    const items = [item('a'), item('b'), item('c')];
    const result = applyQueueMutation(items, { kind: 'move', itemId: 'a', toPosition: 999 });
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('clamps a negative toPosition to 0', () => {
    const items = [item('a'), item('b'), item('c')];
    const result = applyQueueMutation(items, { kind: 'move', itemId: 'c', toPosition: -5 });
    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('is a no-op returning the original array when itemId does not exist', () => {
    const items = [item('a'), item('b')];
    const result = applyQueueMutation(items, { kind: 'move', itemId: 'ghost', toPosition: 0 });
    expect(result).toBe(items);
  });

  it('moving to its own current position is a no-op returning the original array', () => {
    const items = [item('a'), item('b'), item('c')];
    const result = applyQueueMutation(items, { kind: 'move', itemId: 'b', toPosition: 1 });
    expect(result).toBe(items);
  });

  it('result is always reindexed 0..n-1 with no gaps (order carries position)', () => {
    const items = [item('a'), item('b'), item('c'), item('d'), item('e')];
    const result = applyQueueMutation(items, { kind: 'move', itemId: 'e', toPosition: 0 });
    expect(result).toHaveLength(5);
    expect(result.map((i) => i.id)).toEqual(['e', 'a', 'b', 'c', 'd']);
  });

  it('does not mutate the input array', () => {
    const items = [item('a'), item('b'), item('c')];
    const snapshot = [...items];
    applyQueueMutation(items, { kind: 'move', itemId: 'a', toPosition: 2 });
    expect(items).toEqual(snapshot);
  });
});
