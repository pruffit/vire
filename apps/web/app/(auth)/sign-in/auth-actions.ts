'use server';

import { AuthError } from 'next-auth';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { signIn } from '@/auth';
import { findUserByEmail, createUserWithPassword } from '@vire/db';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  callbackUrl: z.string().optional(),
});

const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  callbackUrl: z.string().optional(),
});

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
    callbackUrl: formData.get('callbackUrl') ?? '/',
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return 'Введи корректный email и пароль.';

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: parsed.data.callbackUrl ?? '/',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin') return 'Неверный email или пароль.';
      return 'Ошибка входа. Попробуй ещё раз.';
    }
    throw error; // NEXT_REDIRECT — пробрасываем, Next.js сам обработает
  }
  return null;
}

export async function registerAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    callbackUrl: formData.get('callbackUrl') ?? '/',
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first.path.includes('name')) return 'Имя должно быть от 2 до 60 символов.';
    if (first.path.includes('email')) return 'Введи корректный email.';
    if (first.path.includes('password')) return 'Пароль должен быть не менее 8 символов.';
    return 'Проверь введённые данные.';
  }

  const { name, email, password, callbackUrl } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) return 'Аккаунт с этим email уже существует. Войди вместо этого.';

  const passwordHash = await hash(password, 12);
  await createUserWithPassword({ email, name, passwordHash });

  try {
    await signIn('credentials', { email, password, redirectTo: callbackUrl ?? '/' });
  } catch (error) {
    if (error instanceof AuthError) return 'Аккаунт создан, но войти не удалось. Попробуй войти вручную.';
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
  const email = formData.get('email') as string;
  const callbackUrl = (formData.get('callbackUrl') as string) ?? '/';
  if (!email) return 'Введи email.';
  try {
    await signIn('resend', { email, redirectTo: callbackUrl });
  } catch (error) {
    if (error instanceof AuthError) return 'Не удалось отправить письмо. Проверь email.';
    throw error;
  }
  return null;
}
