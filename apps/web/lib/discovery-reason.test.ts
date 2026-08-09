import { describe, expect, it } from 'vitest';
import { discoveryReasonLabel } from './discovery-reason';

const t = (key: string) => `t:${key}`;

describe('discoveryReasonLabel', () => {
  it('friends', () => {
    expect(discoveryReasonLabel('friends', t)).toBe('t:discoveryReason.friends');
  });

  it('similar', () => {
    expect(discoveryReasonLabel('similar', t)).toBe('t:discoveryReason.similar');
  });

  it('taste', () => {
    expect(discoveryReasonLabel('taste', t)).toBe('t:discoveryReason.taste');
  });
});
