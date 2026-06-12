'use server';

import { z } from 'zod';
import { hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { setUserPasswordHash, getUserAuthInfo } from '@vire/db';

const setPasswordSchema = z.object({
  password: z.string().min(8).max(100),
  confirmPassword: z.string(),
});

export async function setPasswordAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return 'Необходимо войти в аккаунт.';

  const raw = {
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) return 'Пароль должен быть не менее 8 символов.';

  const { password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) return 'Пароли не совпадают.';

  const info = await getUserAuthInfo(session.user.id);
  if (info.hasPassword) return 'Пароль уже задан. Воспользуйся ссылкой для входа, чтобы изменить его.';

  const passwordHash = await hash(password, 12);
  await setUserPasswordHash(session.user.id, passwordHash);

  return 'ok';
}

// ── OAuth linking ──────────────────────────────────────────────────────────────
// Перед началом OAuth кладём userId в httpOnly-cookie.
// Auth.js signIn-callback читает его и переназначает аккаунт нужному пользователю.

async function linkOAuthProvider(provider: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  const jar = await cookies();
  jar.set('vire_link_uid', session.user.id, {
    maxAge: 300, // 5 минут — время жизни OAuth-флоу
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  await signIn(provider, { redirectTo: '/profile' });
}

export async function linkYandexAction() {
  await linkOAuthProvider('yandex');
}

export async function linkGoogleAction() {
  await linkOAuthProvider('google');
}

export async function linkTelegramAction() {
  const session = await auth();
  if (!session?.user?.id) return;

  const jar = await cookies();
  jar.set('vire_link_uid', session.user.id, {
    maxAge: 300,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  redirect('/sign-in?callbackUrl=%2Fprofile');
}

