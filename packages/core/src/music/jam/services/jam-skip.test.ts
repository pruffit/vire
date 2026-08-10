import { describe, it, expect } from 'vitest';
import { resolveSkip } from './jam-skip';

describe('resolveSkip', () => {
  it('1 присутствующий — нужен 1 голос', () => {
    expect(resolveSkip({ votes: 1, presentCount: 1, isHost: false })).toEqual({ skip: true, needed: 1 });
  });

  it('2 присутствующих — нужно 2 голоса (больше половины)', () => {
    expect(resolveSkip({ votes: 1, presentCount: 2, isHost: false })).toEqual({ skip: false, needed: 2 });
    expect(resolveSkip({ votes: 2, presentCount: 2, isHost: false })).toEqual({ skip: true, needed: 2 });
  });

  it('3 присутствующих — нужно 2 голоса', () => {
    expect(resolveSkip({ votes: 1, presentCount: 3, isHost: false })).toEqual({ skip: false, needed: 2 });
    expect(resolveSkip({ votes: 2, presentCount: 3, isHost: false })).toEqual({ skip: true, needed: 2 });
  });

  it('4 присутствующих — нужно 3 голоса', () => {
    expect(resolveSkip({ votes: 2, presentCount: 4, isHost: false })).toEqual({ skip: false, needed: 3 });
    expect(resolveSkip({ votes: 3, presentCount: 4, isHost: false })).toEqual({ skip: true, needed: 3 });
  });

  it('хост скипает с первого голоса независимо от порога', () => {
    expect(resolveSkip({ votes: 1, presentCount: 4, isHost: true })).toEqual({ skip: true, needed: 3 });
  });

  it('нулевое присутствие — порог не падает ниже 1', () => {
    expect(resolveSkip({ votes: 0, presentCount: 0, isHost: false })).toEqual({ skip: false, needed: 1 });
  });
});
