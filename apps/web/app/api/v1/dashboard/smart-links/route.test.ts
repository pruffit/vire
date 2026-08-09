import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, slugTaken, create, releaseOwnedByArtist, uploadToStream } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  slugTaken: vi.fn().mockResolvedValue(false),
  create: vi.fn(),
  releaseOwnedByArtist: vi.fn().mockResolvedValue(true),
  uploadToStream: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleSmartLinkRepository: class {
    slugTaken = slugTaken;
    create = create;
    releaseOwnedByArtist = releaseOwnedByArtist;
  },
}));
vi.mock('@/lib/s3', () => ({ uploadToStream }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

function makeReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request('http://localhost/api/v1/dashboard/smart-links', { method: 'POST', body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  slugTaken.mockResolvedValue(false);
  releaseOwnedByArtist.mockResolvedValue(true);
});

describe('POST /api/v1/dashboard/smart-links', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(makeReq({ title: 'X' }))).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await POST(makeReq({ title: 'X' }))).status).toBe(403);
  });

  it('400 when the title is missing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(makeReq({ title: '   ' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Нужно название', code: 'smartLink.titleRequired' });
    expect(create).not.toHaveBeenCalled();
  });

  it('409 when the slug is already taken', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    slugTaken.mockResolvedValue(true);
    const res = await POST(makeReq({ title: 'X', slug: 'taken' }));
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: 'Такой адрес уже занят', code: 'smartLink.slugTaken' });
    expect(create).not.toHaveBeenCalled();
  });

  it('400 when the release is not owned by the artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    releaseOwnedByArtist.mockResolvedValue(false);
    const res = await POST(makeReq({ title: 'X', releaseId: 'rel-1' }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Релиз не найден', code: 'smartLink.releaseNotFound' });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the smart link', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    create.mockResolvedValue('sl-1');
    const res = await POST(makeReq({ title: 'Neon Drop' }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: 'sl-1', slug: 'neon-drop' });
    expect(create).toHaveBeenCalledWith('artist1', expect.objectContaining({ title: 'Neon Drop', slug: 'neon-drop' }));
  });
});
