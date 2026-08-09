'use server';

import { AuthError } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { signIn } from '@/auth';
import { db, DrizzleUserAccountRepository } from '@vire/db';
import { AuthService, ConflictError } from '@vire/core';
import { BcryptPasswordHasher } from '@/lib/password-hasher';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  callbackUrl: z.string().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  // Явное согласие на обработку ПДн: обязательно (152-ФЗ).
  consent: z.literal('on'),
  callbackUrl: z.string().optional(),
});

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const t = await getTranslations('auth.errors');
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    callbackUrl: formData.get('callbackUrl') ?? '/',
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return t('invalidCredentials');

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: parsed.data.callbackUrl ?? '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') return t('wrongCredentials');
      return t('genericSignIn');
    }
    throw error; // NEXT_REDIRECT: пробрасываем, Next.js сам обработает
  }
  return null;
}

export async function registerAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const t = await getTranslations('auth.errors');
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    consent: formData.get('consent'),
    callbackUrl: formData.get('callbackUrl') ?? '/',
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first.path.includes('name')) return t('invalidName');
    if (first.path.includes('email')) return t('invalidEmail');
    if (first.path.includes('password')) return t('invalidPassword');
    if (first.path.includes('consent')) return t('consentRequired');
    return t('checkFields');
  }

  const { name, email, password, callbackUrl } = parsed.data;

  const service = new AuthService(new DrizzleUserAccountRepository(db), { hasher: new BcryptPasswordHasher() });
  const result = await service.register({ email, name, password });
  if (!result.ok) {
    if (result.error instanceof ConflictError) return t('accountExists');
    throw result.error;
  }

  try {
    await signIn('credentials', { email, password, redirectTo: callbackUrl ?? '/' });
  } catch (error) {
    if (error instanceof AuthError) return t('registeredButSignInFailed');
    throw error;
  }
  return null;
}

export async function signInYandexAction(formData: FormData) {
  const callbackUrl = (formData.get('callbackUrl') as string) ?? '/';
  await signIn('yandex', { redirectTo: callbackUrl });
}

export async function signInMagicLinkAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const t = await getTranslations('auth.errors');
  const email = formData.get('email') as string;
  const callbackUrl = (formData.get('callbackUrl') as string) ?? '/';
  if (!email) return t('emailRequired');
  try {
    await signIn('nodemailer', { email, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) return t('magicLinkFailed');
    throw error;
  }
  return null;
}
