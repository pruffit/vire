import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateProfileResponseSchema, avatarResponseSchema } from '@vire/api-contracts';

const {
  updateUserName,
  updateUserImage,
  updateUserSocialVisibility,
  updateUserDiscoverable,
  updateUserNotifyEmail,
  updateUserNotifyPush,
  updateUserLastfmUsername,
  updateUserLocale,
  uploadToStream,
} = vi.hoisted(() => ({
  updateUserName: vi.fn(),
  updateUserImage: vi.fn(),
  updateUserSocialVisibility: vi.fn(),
  updateUserDiscoverable: vi.fn(),
  updateUserNotifyEmail: vi.fn(),
  updateUserNotifyPush: vi.fn(),
  updateUserLastfmUsername: vi.fn(),
  updateUserLocale: vi.fn(),
  uploadToStream: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  updateUserName,
  updateUserImage,
  updateUserSocialVisibility,
  updateUserDiscoverable,
  updateUserNotifyEmail,
  updateUserNotifyPush,
  updateUserLastfmUsername,
  updateUserLocale,
}));
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

  it('happy path: updates the social visibility', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ socialVisibility: 'PRIVATE' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, socialVisibility: 'PRIVATE' });
    expect(updateUserSocialVisibility).toHaveBeenCalledWith('u1', 'PRIVATE');
    expect(updateUserName).not.toHaveBeenCalled();
  });

  it('400 on an invalid social visibility value', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ socialVisibility: 'PUBLIC' }));
    expect(res.status).toBe(400);
    expect(updateUserSocialVisibility).not.toHaveBeenCalled();
  });

  it('400 when the body has neither name nor socialVisibility', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({}));
    expect(res.status).toBe(400);
    expect(updateUserName).not.toHaveBeenCalled();
    expect(updateUserSocialVisibility).not.toHaveBeenCalled();
  });

  it('PATCH принимает discoverable и зовёт updateUserDiscoverable', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ discoverable: false }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, discoverable: false });
    expect(updateUserDiscoverable).toHaveBeenCalledWith('u1', false);
  });

  it('PATCH принимает notifyEmail и зовёт updateUserNotifyEmail', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ notifyEmail: false }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, notifyEmail: false });
    expect(updateUserNotifyEmail).toHaveBeenCalledWith('u1', false);
  });

  it('PATCH принимает notifyPush и зовёт updateUserNotifyPush', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ notifyPush: true }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, notifyPush: true });
    expect(updateUserNotifyPush).toHaveBeenCalledWith('u1', true);
  });

  it('PATCH принимает валидный lastfmUsername и зовёт updateUserLastfmUsername', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ lastfmUsername: 'danya_music' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, lastfmUsername: 'danya_music' });
    expect(updateUserLastfmUsername).toHaveBeenCalledWith('u1', 'danya_music');
  });

  it('PATCH принимает null lastfmUsername (отвязка)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ lastfmUsername: null }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, lastfmUsername: null });
    expect(updateUserLastfmUsername).toHaveBeenCalledWith('u1', null);
  });

  it('PATCH принимает locale и зовёт updateUserLocale', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ locale: 'en' }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, locale: 'en' });
    expect(updateUserLocale).toHaveBeenCalledWith('u1', 'en');
  });

  it('400 на неизвестную locale', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ locale: 'fr' }));
    expect(res.status).toBe(400);
  });

  it('400 на мусорный lastfmUsername', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await PATCH(patchReq({ lastfmUsername: 'not a valid username!!' }));
    expect(res.status).toBe(400);
    expect(updateUserLastfmUsername).not.toHaveBeenCalled();
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
    expect(avatarResponseSchema.safeParse(body).success).toBe(true);
  });
});

describe('контракт ответов профиля', () => {
  it('PATCH возвращает только применённые поля и проходит схему', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

    const body = await (await PATCH(patchReq({ name: 'Аня', locale: 'en' }))).json();

    expect(updateProfileResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({ ok: true, name: 'Аня', locale: 'en' });
    // поля, которых не было в запросе, не приходят: иначе клиент решит, что их сбросили
    expect(body).not.toHaveProperty('notifyEmail');
  });

  it('удаление аватара отдаёт image: null по контракту', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);

    const body = await (await POST(postReq({ removeAvatar: '1' }))).json();

    expect(avatarResponseSchema.safeParse(body).success).toBe(true);
    expect(body.image).toBeNull();
  });
});
