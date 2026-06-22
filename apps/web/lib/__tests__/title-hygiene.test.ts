import { describe, it, expect } from 'vitest';
import { titleRepeatsArtist } from '../title-hygiene';

describe('titleRepeatsArtist', () => {
  it('detects artist name prefix before the real title', () => {
    expect(titleRepeatsArtist('AVOCADICK Бедный музыкант', 'AVOCADICK')).toBe(true);
    expect(titleRepeatsArtist('AVOCADICK - Я на чилле', 'AVOCADICK')).toBe(true);
    expect(titleRepeatsArtist('avocadick: лето', 'AVOCADICK')).toBe(true);
  });

  it('is case-insensitive and tolerant of extra spaces', () => {
    expect(titleRepeatsArtist('  AvocaDick   Новый папа ', 'avocadick')).toBe(true);
  });

  it('does not trigger when title is exactly the artist name (self-titled)', () => {
    expect(titleRepeatsArtist('AVOCADICK', 'AVOCADICK')).toBe(false);
  });

  it('does not trigger when title does not start with the artist name', () => {
    expect(titleRepeatsArtist('Бедный музыкант', 'AVOCADICK')).toBe(false);
    expect(titleRepeatsArtist('My AVOCADICK song', 'AVOCADICK')).toBe(false);
  });

  it('ignores too-short or empty artist names', () => {
    expect(titleRepeatsArtist('A song', 'A')).toBe(false);
    expect(titleRepeatsArtist('song', '')).toBe(false);
  });

  it('requires a real remainder, not just a trailing separator', () => {
    expect(titleRepeatsArtist('AVOCADICK -', 'AVOCADICK')).toBe(false);
  });
});
