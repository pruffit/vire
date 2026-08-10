'use server';

import { z } from 'zod';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { auth, signIn } from '@/auth';
import { db, DrizzleUserAccountRepository } from '@vire/db';
import { AuthService, ConflictError } from '@vire/core';
import { BcryptPasswordHasher } from '@/lib/password-hasher';

const setPasswordSchema = z.object({
  password: z.string().min(8).max(100),
  confirmPassword: z.string(),
});

export async function setPasswordAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const t = await getTranslations('auth.errors');
  const session = await auth();
  if (!session?.user?.id) return t('signInRequired');

  const raw = {
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) return t('invalidPassword');

  const { password, confirmPassword } = parsed.data;
  if (password !== confirmPassword) return t('passwordMismatch');

  const service = new AuthService(new DrizzleUserAccountRepository(db), { hasher: new BcryptPasswordHasher() });
  const result = await service.setPassword(session.user.id, password);
  if (!result.ok) {
    if (result.error instanceof ConflictError) return t('passwordAlreadySet');
    throw result.error;
  }

  return 'ok';
}

// ── OAuth linking: userId в httpOnly-cookie, signIn-callback Auth.js читает его и переназначает аккаунт ──

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

