import { describe, expect, it } from 'vitest';
import { discoveryReasonLabel } from './discovery-reason';

describe('discoveryReasonLabel', () => {
  it('friends', () => {
    expect(discoveryReasonLabel('friends')).toBe('Слушают ваши друзья');
  });

  it('similar', () => {
    expect(discoveryReasonLabel('similar')).toBe('Похоже на то, что вы слушаете');
  });

  it('taste', () => {
    expect(discoveryReasonLabel('taste')).toBe('В вашем жанре');
  });
});
