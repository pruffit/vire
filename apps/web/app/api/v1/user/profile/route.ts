import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { updateUserName, updateUserImage } from '@vire/db';
import { uploadToStream } from '@/lib/s3';

const schema = z.object({
  name: z.string().min(1).max(50),
});

const AVATAR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 МБ

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

  const name = parsed.data.name.trim();
  await updateUserName(session.user.id, name);

  return NextResponse.json({ ok: true, name });
}

// Загрузка / удаление собственного аватара (multipart: avatar | removeAvatar=1)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  if (formData.get('removeAvatar') === '1') {
    await updateUserImage(session.user.id, null);
    return NextResponse.json({ ok: true, image: null });
  }

  const avatar = formData.get('avatar');
  if (!(avatar instanceof File) || avatar.size === 0) {
    return NextResponse.json({ error: 'No file' }, { status: 400 });
  }
  const ext = AVATAR_MIME[avatar.type];
  if (!ext) {
    return NextResponse.json({ error: 'Аватар должен быть JPEG, PNG или WebP' }, { status: 400 });
  }
  if (avatar.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'Файл больше 5 МБ' }, { status: 400 });
  }

  const buffer = Buffer.from(await avatar.arrayBuffer());
  const url = await uploadToStream(`avatars/users/${session.user.id}.${ext}`, buffer, avatar.type);
  // ?v= сбивает кэш браузера/next-image при стабильном ключе S3
  const image = `${url}?v=${Date.now()}`;
  await updateUserImage(session.user.id, image);

  return NextResponse.json({ ok: true, image });
}
