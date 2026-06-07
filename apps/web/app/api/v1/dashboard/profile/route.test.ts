import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, update, uploadToStream } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  update: vi.fn(),
  uploadToStream: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
    update = update;
  },
}));
vi.mock('@/lib/s3', () => ({ uploadToStream }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

const ARTIST = {
  id: 'artist1',
  avatarUrl: null,
  links: [],
  videos: [],
  themeTokens: { bg: '#000000', text: '#ffffff', accent: '#ff0000', grain: false, fontSans: 'Inter', fontMono: 'Fira Code' },
};

function makeReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request('http://localhost/api/v1/dashboard/profile', { method: 'POST', body: fd });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/dashboard/profile', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(makeReq({ name: 'A' }))).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await POST(makeReq({ name: 'A' }))).status).toBe(403);
  });

  it('400 when the name is missing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(ARTIST);
    const res = await POST(makeReq({ name: '   ' }));
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('400 when the avatar has an unsupported mime type', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(ARTIST);
    const res = await POST(
      makeReq({ name: 'A', avatar: new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' }) }),
    );
    expect(res.status).toBe(400);
    expect(uploadToStream).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('updates the profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(ARTIST);
    const res = await POST(makeReq({ name: '  Danya  ' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith('artist1', expect.objectContaining({ name: 'Danya' }));
  });
});
