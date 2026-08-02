import { describe, it, expect } from 'vitest';
import { applyQueueMutation, insertPartyQueueItem, type QueueMutation } from './jam-queue';
import type { JamQueueItemWrite } from '../repositories/jam';

const ADDED_AT = new Date('2026-07-20T12:00:00Z');

const item = (id: string, overrides?: Partial<JamQueueItemWrite>): JamQueueItemWrite => ({
  id,
  source: 'VIRE',
  trackId: `track-${id}`,
  externalId: null,
  externalUrl: null,
  title: null,
  artistName: null,
  coverUrl: null,
  durationSec: null,
  addedByParticipantId: 'p1',
  addedAt: ADDED_AT,
  ...overrides,
});

const addVire = (trackId: string, participantId: string, addedAt = ADDED_AT): QueueMutation => ({
  kind: 'add',
  entry: { source: 'VIRE', trackId },
  participantId,
  addedAt,
});

describe('applyQueueMutation — add', () => {
  it('appends a new VIRE item without an id, at the end', () => {
    const items = [item('a'), item('b')];

    const result = applyQueueMutation(items, addVire('track-new', 'p2'));

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({
      source: 'VIRE', trackId: 'track-new', externalId: null, externalUrl: null,
      title: null, artistName: null, coverUrl: null, durationSec: null,
      addedByParticipantId: 'p2', addedAt: ADDED_AT,
    });
    expect('id' in result[2]!).toBe(false);
  });

  it('appends a new external item carrying its metadata snapshot', () => {
    const mutation: QueueMutation = {
      kind: 'add',
      entry: { source: 'YOUTUBE', externalId: 'yt-1', externalUrl: 'https://youtu.be/yt-1', title: 'Song', artistName: 'Artist', coverUrl: 'https://img', durationSec: 180 },
      participantId: 'p2',
      addedAt: ADDED_AT,
    };

    const result = applyQueueMutation([], mutation);

    expect(result[0]).toEqual({
      source: 'YOUTUBE', trackId: null, externalId: 'yt-1', externalUrl: 'https://youtu.be/yt-1',
      title: 'Song', artistName: 'Artist', coverUrl: 'https://img', durationSec: 180,
      addedByParticipantId: 'p2', addedAt: ADDED_AT,
    });
  });

  it('preserves existing items and their ids unchanged', () => {
    const items = [item('a'), item('b')];

    const result = applyQueueMutation(items, addVire('track-new', 'p2'));

    expect(result[0]).toEqual(items[0]);
    expect(result[1]).toEqual(items[1]);
  });

  it('adding into an empty queue produces a single item at index 0', () => {
    const result = applyQueueMutation([], addVire('t1', 'p1'));
    expect(result).toHaveLength(1);
    expect(result[0]!.trackId).toBe('t1');
  });

  it('does not mutate the input array', () => {
    const items = [item('a')];
    const snapshot = [...items];
    applyQueueMutation(items, addVire('t2', 'p1'));
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

describe('applyQueueMutation — shuffle', () => {
  it('is deterministic given a fake random source and keeps the same set of items', () => {
    const items = [item('a'), item('b'), item('c'), item('d')];

    // Fisher-Yates, i от последнего к 1, j = floor(random() * (i+1)); random()=0 всегда даёт j=0.
    const result = applyQueueMutation(items, { kind: 'shuffle', random: () => 0 });

    expect(result.map((it) => it.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(result.map((it) => it.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('is a no-op on an empty or single-item queue', () => {
    expect(applyQueueMutation([], { kind: 'shuffle', random: () => 0 })).toEqual([]);
    const single = [item('a')];
    expect(applyQueueMutation(single, { kind: 'shuffle', random: () => 0 })).toEqual(single);
  });

  it('does not mutate the input array', () => {
    const items = [item('a'), item('b'), item('c')];
    const snapshot = [...items];
    applyQueueMutation(items, { kind: 'shuffle', random: () => 0.5 });
    expect(items).toEqual(snapshot);
  });
});

describe('insertPartyQueueItem', () => {
  const forParticipant = (id: string, participantId: string) => item(id, { addedByParticipantId: participantId });

  it('single guest — FIFO order (round-robin with one contributor is a plain append)', () => {
    let queue: JamQueueItemWrite[] = [];
    queue = insertPartyQueueItem(queue, forParticipant('a1', 'guest-a'), { addedByParticipantId: 'guest-a', currentItemId: null });
    queue = insertPartyQueueItem(queue, forParticipant('a2', 'guest-a'), { addedByParticipantId: 'guest-a', currentItemId: null });
    queue = insertPartyQueueItem(queue, forParticipant('a3', 'guest-a'), { addedByParticipantId: 'guest-a', currentItemId: null });

    expect(queue.map((i) => i.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('three guests mixed in — a newcomer\'s first track is inserted before the earlier round of others, not appended', () => {
    let queue: JamQueueItemWrite[] = [];
    queue = insertPartyQueueItem(queue, forParticipant('a1', 'A'), { addedByParticipantId: 'A', currentItemId: null });
    queue = insertPartyQueueItem(queue, forParticipant('b1', 'B'), { addedByParticipantId: 'B', currentItemId: null });
    queue = insertPartyQueueItem(queue, forParticipant('c1', 'C'), { addedByParticipantId: 'C', currentItemId: null });
    // A's second track — no one else has an unplayed second track yet, goes to the end.
    queue = insertPartyQueueItem(queue, forParticipant('a2', 'A'), { addedByParticipantId: 'A', currentItemId: null });
    expect(queue.map((i) => i.id)).toEqual(['a1', 'b1', 'c1', 'a2']);

    // B's second track — same round as a2, goes after it (FIFO within a round).
    queue = insertPartyQueueItem(queue, forParticipant('b2', 'B'), { addedByParticipantId: 'B', currentItemId: null });
    expect(queue.map((i) => i.id)).toEqual(['a1', 'b1', 'c1', 'a2', 'b2']);

    // D's first track must land before a2/b2 (round 1) — not after — the invariant this queue exists for.
    queue = insertPartyQueueItem(queue, forParticipant('d1', 'D'), { addedByParticipantId: 'D', currentItemId: null });
    expect(queue.map((i) => i.id)).toEqual(['a1', 'b1', 'c1', 'd1', 'a2', 'b2']);
  });

  it('adding during playback does not move the currently playing position or anything before it', () => {
    const queue = [forParticipant('a1', 'A'), forParticipant('b1', 'B'), forParticipant('a2', 'A')];
    const result = insertPartyQueueItem(queue, forParticipant('c1', 'C'), { addedByParticipantId: 'C', currentItemId: 'a1' });

    // a1 is locked (playing); only the future tail (b1, a2) is subject to round-robin.
    expect(result.map((i) => i.id)).toEqual(['a1', 'b1', 'c1', 'a2']);
  });

  it('empty queue — the new item becomes the only entry', () => {
    const result = insertPartyQueueItem([], item('a1'), { addedByParticipantId: 'p1', currentItemId: null });
    expect(result.map((i) => i.id)).toEqual(['a1']);
  });
});
