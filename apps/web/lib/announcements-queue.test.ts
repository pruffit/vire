import { describe, expect, it } from 'vitest';
import { nextAutoAnnouncement } from './announcements-queue';

const list = [
  { id: 'a', storageKey: 'k_a' },
  { id: 'b', storageKey: 'k_b' },
] as const;

describe('nextAutoAnnouncement', () => {
  it('возвращает первый непросмотренный', () => {
    expect(nextAutoAnnouncement(list, () => false)?.id).toBe('a');
  });

  it('пропускает просмотренные', () => {
    expect(nextAutoAnnouncement(list, (k) => k === 'k_a')?.id).toBe('b');
  });

  it('null, когда всё просмотрено', () => {
    expect(nextAutoAnnouncement(list, () => true)).toBeNull();
  });

  it('null на пустой очереди', () => {
    expect(nextAutoAnnouncement([], () => false)).toBeNull();
  });
});
