'use server';

import { z } from 'zod';
import { hash } from 'bcryptjs';
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

export async function linkYandexAction() {
  await signIn('yandex', { redirectTo: '/profile' });
}

export async function linkGoogleAction() {
  await signIn('google', { redirectTo: '/profile' });
}

export async function linkVKAction() {
  await signIn('vk', { redirectTo: '/profile' });
}
