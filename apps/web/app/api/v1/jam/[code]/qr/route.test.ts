import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ValidationError } from '@vire/core';

const { resolveCode } = vi.hoisted(() => ({ resolveCode: vi.fn() }));
const { toString } = vi.hoisted(() => ({ toString: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode }) }));
vi.mock('qrcode', () => ({ default: { toString } }));

import { GET } from './route';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = () => new Request('http://localhost/api/v1/jam/A2B3C4/qr');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/jam/[code]/qr', () => {
  it('400 on a malformed code', async () => {
    resolveCode.mockResolvedValue({ ok: false, error: new ValidationError('Неверный код джема') });

    const res = await GET(req(), ctx('bad'));

    expect(res.status).toBe(400);
    expect(toString).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await GET(req(), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(toString).not.toHaveBeenCalled();
  });

  it('renders an SVG QR code pointing at the public jam URL', async () => {
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });
    toString.mockResolvedValue('<svg>qr</svg>');

    const res = await GET(req(), ctx('A2B3C4'));
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(body).toBe('<svg>qr</svg>');
    expect(toString).toHaveBeenCalledWith('http://localhost:3000/jam/A2B3C4', { type: 'svg' });
  });

  it('renders a party-room URL for a PARTY-kind session', async () => {
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4', kind: 'PARTY' } });
    toString.mockResolvedValue('<svg>qr</svg>');

    await GET(req(), ctx('A2B3C4'));

    expect(toString).toHaveBeenCalledWith('http://localhost:3000/nrvz914/A2B3C4', { type: 'svg' });
  });

  it('sets a long-lived cache header — the code-to-URL mapping never changes', async () => {
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1', code: 'A2B3C4' } });
    toString.mockResolvedValue('<svg>qr</svg>');

    const res = await GET(req(), ctx('A2B3C4'));

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=86400, immutable');
  });
});
