import { describe, it, expect } from 'vitest';
import { shouldRunTicker } from './use-audio-time';

describe('shouldRunTicker', () => {
  it('играет и активен — тикер запускается', () => {
    expect(shouldRunTicker(true, true)).toBe(true);
  });

  it('не активен (неактивный трек в списке/лирика чужого трека) — не тикает, даже если что-то играет', () => {
    expect(shouldRunTicker(false, true)).toBe(false);
  });

  it('активен, но ничего не играет — не тикает', () => {
    expect(shouldRunTicker(true, false)).toBe(false);
  });

  it('не активен и ничего не играет — не тикает', () => {
    expect(shouldRunTicker(false, false)).toBe(false);
  });
});
