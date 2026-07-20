import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/v1/jam/time', () => {
  it('200 with a numeric now close to the current time', async () => {
    const before = Date.now();
    const res = GET();
    const after = Date.now();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.now).toBe('number');
    expect(body.now).toBeGreaterThanOrEqual(before);
    expect(body.now).toBeLessThanOrEqual(after + 50);
  });

  it('sets Cache-Control: no-store', () => {
    const res = GET();
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });
});
