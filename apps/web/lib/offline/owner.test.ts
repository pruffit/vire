// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { shouldPurge, getSavedOwner, setSavedOwner } from './owner';

describe('shouldPurge', () => {
  it('первый заход — сохранённого владельца нет, чистить не нужно', () => {
    expect(shouldPurge(null, 'user-1')).toBe(false);
  });

  it('тот же владелец — чистить не нужно', () => {
    expect(shouldPurge('user-1', 'user-1')).toBe(false);
  });

  it('смена владельца — нужно почистить', () => {
    expect(shouldPurge('user-1', 'user-2')).toBe(true);
  });

  it('вход после анонима — нужно почистить', () => {
    expect(shouldPurge('anon', 'user-1')).toBe(true);
  });
});

describe('getSavedOwner / setSavedOwner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('без сохранённого значения возвращает null', () => {
    expect(getSavedOwner()).toBeNull();
  });

  it('setSavedOwner записывает значение, читаемое обратно', () => {
    setSavedOwner('user-1');
    expect(getSavedOwner()).toBe('user-1');
  });
});
