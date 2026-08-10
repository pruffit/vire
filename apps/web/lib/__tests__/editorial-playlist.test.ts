import { describe, it, expect } from 'vitest';
import { editorialPlaylistMapping, editorialPlaylistText } from '../editorial-playlist';

describe('editorialPlaylistMapping', () => {
  it('TRENDING/RELISTEN/FRESH игнорируют params', () => {
    expect(editorialPlaylistMapping('TRENDING', null)).toEqual({ key: 'trending' });
    expect(editorialPlaylistMapping('RELISTEN', null)).toEqual({ key: 'relisten' });
    expect(editorialPlaylistMapping('FRESH', null)).toEqual({ key: 'fresh' });
  });

  it('MOOD с params даёт mood-ключ', () => {
    expect(editorialPlaylistMapping('MOOD', { mood: 'NIGHT' })).toEqual({ key: 'mood', mood: 'NIGHT' });
  });

  it('MOOD без params — фолбэк на заголовок из БД (легаси до бэкфилла)', () => {
    expect(editorialPlaylistMapping('MOOD', null)).toBeNull();
  });

  it('PERSONAL с mood — личная mood-подборка', () => {
    expect(editorialPlaylistMapping('PERSONAL', { mood: 'CHILL' })).toEqual({ key: 'personalMood', mood: 'CHILL' });
  });

  it('PERSONAL без params — микс «Для тебя»', () => {
    expect(editorialPlaylistMapping('PERSONAL', null)).toEqual({ key: 'personalMix' });
  });

  it('USER и незнакомые kind — не редакционные', () => {
    expect(editorialPlaylistMapping('USER', null)).toBeNull();
    expect(editorialPlaylistMapping('WHATEVER', null)).toBeNull();
  });
});

describe('editorialPlaylistText', () => {
  const t = (key: string, values?: Record<string, string | number>) =>
    values ? `${key}(${JSON.stringify(values)})` : key;
  const tMoods = (key: string) => `mood:${key}`;
  const fallback = { title: 'Заголовок из БД', description: 'Описание из БД' };

  it('редакционный kind подставляет ключ словаря', () => {
    expect(editorialPlaylistText(t, tMoods, 'TRENDING', null, fallback)).toEqual({
      title: 'editorial.trending.title',
      description: 'editorial.trending.description',
    });
  });

  it('mood-ключ получает уже локализованный лейбл настроения параметром', () => {
    expect(editorialPlaylistText(t, tMoods, 'MOOD', { mood: 'NIGHT' }, fallback)).toEqual({
      title: 'editorial.mood.title({"mood":"mood:NIGHT"})',
      description: 'editorial.mood.description({"mood":"mood:NIGHT"})',
    });
  });

  it('USER-плейлист берёт фолбэк из БД', () => {
    expect(editorialPlaylistText(t, tMoods, 'USER', null, fallback)).toEqual(fallback);
  });
});
