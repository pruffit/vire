import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCaller } from '@/lib/caller';
import {
  updateUserName,
  updateUserImage,
  updateUserSocialVisibility,
  updateUserDiscoverable,
  updateUserNotifyEmail,
  updateUserNotifyPush,
  updateUserLastfmUsername,
  updateUserLocale,
} from '@vire/db';
import { LOCALES } from '@vire/i18n/config';
import { uploadToStream } from '@/lib/s3';
import { validateImageUpload, AVATAR_POLICY } from '@/lib/image';

const LASTFM_USERNAME_RE = /^[a-zA-Z0-9_.-]{2,64}$/;

const schema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    socialVisibility: z.enum(['FRIENDS', 'PRIVATE']).optional(),
    discoverable: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    lastfmUsername: z.string().regex(LASTFM_USERNAME_RE).max(64).nullable().optional(),
    locale: z.enum(LOCALES).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nothing to update' });

export async function PATCH(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { name, socialVisibility, discoverable, notifyEmail, notifyPush, lastfmUsername, locale } = parsed.data;
  if (name !== undefined) await updateUserName(caller.id, name);
  if (socialVisibility !== undefined) await updateUserSocialVisibility(caller.id, socialVisibility);
  if (discoverable !== undefined) await updateUserDiscoverable(caller.id, discoverable);
  if (notifyEmail !== undefined) await updateUserNotifyEmail(caller.id, notifyEmail);
  if (notifyPush !== undefined) await updateUserNotifyPush(caller.id, notifyPush);
  if (lastfmUsername !== undefined) await updateUserLastfmUsername(caller.id, lastfmUsername);
  if (locale !== undefined) await updateUserLocale(caller.id, locale);

  return NextResponse.json({
    ok: true,
    ...(name !== undefined ? { name } : {}),
    ...(socialVisibility !== undefined ? { socialVisibility } : {}),
    ...(discoverable !== undefined ? { discoverable } : {}),
    ...(notifyEmail !== undefined ? { notifyEmail } : {}),
    ...(notifyPush !== undefined ? { notifyPush } : {}),
    ...(lastfmUsername !== undefined ? { lastfmUsername } : {}),
    ...(locale !== undefined ? { locale } : {}),
  });
}

// Загрузка / удаление собственного аватара (multipart: avatar | removeAvatar=1)
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  if (formData.get('removeAvatar') === '1') {
    await updateUserImage(caller.id, null);
    return NextResponse.json({ ok: true, image: null });
  }

  const avatar = formData.get('avatar');
  if (!(avatar instanceof File) || avatar.size === 0) {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }

  const buffer = Buffer.from(await avatar.arrayBuffer());
  const v = validateImageUpload(avatar.size, buffer, AVATAR_POLICY);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
  const url = await uploadToStream(`avatars/users/${caller.id}.${v.info.ext}`, buffer, v.info.mime);
  // ?v= сбивает кэш браузера/next-image при стабильном ключе S3
  const image = `${url}?v=${Date.now()}`;
  await updateUserImage(caller.id, image);

  return NextResponse.json({ ok: true, image });
}
