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
  headerUrl: null,
  links: [],
  videos: [],
  themeTokens: { bg: '#000000', text: '#ffffff', accent: '#ff0000', grain: false, fontSans: 'Inter', fontMono: 'Fira Code' },
};

// Minimal valid PNG bytes with configurable dimensions (for validateImageUpload probing)
function makePng(width: number, height: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(new ArrayBuffer(24));
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
  buf.set([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8); // IHDR chunk
  buf[16] = (width >> 24) & 0xff; buf[17] = (width >> 16) & 0xff;
  buf[18] = (width >> 8) & 0xff;  buf[19] = width & 0xff;
  buf[20] = (height >> 24) & 0xff; buf[21] = (height >> 16) & 0xff;
  buf[22] = (height >> 8) & 0xff;  buf[23] = height & 0xff;
  return buf;
}

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

  it('400 when the header has invalid format', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(ARTIST);
    const res = await POST(
      makeReq({ name: 'A', header: new File([new Uint8Array([1])], 'h.gif', { type: 'image/gif' }) }),
    );
    expect(res.status).toBe(400);
    expect(uploadToStream).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('removeAvatar wins over an attached invalid file: 200, avatar removed', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ ...ARTIST, avatarUrl: 'https://cdn.example.com/avatars/artist1.png' });
    const res = await POST(
      makeReq({
        name: 'A',
        removeAvatar: '1',
        avatar: new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(uploadToStream).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith('artist1', expect.objectContaining({ avatarUrl: null }));
  });

  it('removeHeader wins over an attached invalid file: 200, header removed', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ ...ARTIST, headerUrl: 'https://cdn.example.com/headers/artist1.png' });
    const res = await POST(
      makeReq({
        name: 'A',
        removeHeader: '1',
        header: new File([new Uint8Array([1])], 'h.gif', { type: 'image/gif' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(uploadToStream).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith('artist1', expect.objectContaining({ headerUrl: null }));
  });

  it('uploads header and saves headerUrl', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(ARTIST);
    uploadToStream.mockResolvedValue('https://cdn.example.com/headers/artist1.png');
    const pngBytes = makePng(1500, 500);
    const res = await POST(
      makeReq({ name: 'A', header: new File([pngBytes], 'banner.png', { type: 'image/png' }) }),
    );
    expect(res.status).toBe(200);
    expect(uploadToStream).toHaveBeenCalledWith('headers/artist1.png', expect.any(Buffer), 'image/png');
    // ?v=timestamp сбивает кэш при стабильном ключе S3
    expect(update).toHaveBeenCalledWith(
      'artist1',
      expect.objectContaining({ headerUrl: expect.stringMatching(/^https:\/\/cdn\.example\.com\/headers\/artist1\.png\?v=\d+$/) }),
    );
  });
});
