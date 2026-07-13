import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateUserName, updateUserImage, uploadToStream } = vi.hoisted(() => ({
  updateUserName: vi.fn(),
  updateUserImage: vi.fn(),
  uploadToStream: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ updateUserName, updateUserImage }));
vi.mock('@/lib/s3', () => ({ uploadToStream }));

import { auth } from '@/auth';
import { PATCH, POST } from './route';

const mockedAuth = vi.mocked(auth);

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

function patchReq(body: unknown): Request {
  return new Request('http://localhost/api/v1/user/profile', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

function postReq(fields: Record<string, string | File>): Request {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return new Request('http://localhost/api/v1/user/profile', { method: 'POST', body: fd });
}

beforeEach(() => vi.clearAllMocks());

describe('PATCH /api/v1/user/profile', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await PATCH(patchReq({ name: 'Danya' }));
    expect(res.status).toBe(401);
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('400 when the name is missing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({}));
    expect(res.status).toBe(400);
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('400 when the name is whitespace-only', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ name: '   ' }));
    expect(res.status).toBe(400);
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('400 when the name exceeds the max length', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ name: 'x'.repeat(51) }));
    expect(res.status).toBe(400);
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('happy path: trims and saves the name', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ name: '  Danya  ' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, name: 'Danya' });
    expect(updateUserName).toHaveBeenCalledWith('u1', 'Danya');
  });
});

describe('POST /api/v1/user/profile', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(postReq({}));
    expect(res.status).toBe(401);
    expect(updateUserImage).not.toHaveBeenCalled();
  });

  it('removeAvatar: clears the avatar without touching S3', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(postReq({ removeAvatar: '1' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, image: null });
    expect(uploadToStream).not.toHaveBeenCalled();
    expect(updateUserImage).toHaveBeenCalledWith('u1', null);
  });

  it('400 when no file is attached', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    expect(updateUserImage).not.toHaveBeenCalled();
  });

  it('400 on an unsupported image format', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(
      postReq({ avatar: new File([new Uint8Array([1])], 'a.gif', { type: 'image/gif' }) }),
    );
    expect(res.status).toBe(400);
    expect(uploadToStream).not.toHaveBeenCalled();
    expect(updateUserImage).not.toHaveBeenCalled();
  });

  it('happy path: uploads to S3 and cache-busts the saved URL', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    uploadToStream.mockResolvedValue('https://cdn.example.com/avatars/users/u1.png');
    const pngBytes = makePng(500, 500);
    const res = await POST(
      postReq({ avatar: new File([pngBytes], 'avatar.png', { type: 'image/png' }) }),
    );
    expect(res.status).toBe(200);
    expect(uploadToStream).toHaveBeenCalledWith('avatars/users/u1.png', expect.any(Buffer), 'image/png');
    const body = await res.json();
    expect(body.image).toMatch(/^https:\/\/cdn\.example\.com\/avatars\/users\/u1\.png\?v=\d+$/);
    expect(updateUserImage).toHaveBeenCalledWith('u1', body.image);
  });
});
