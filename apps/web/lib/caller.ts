import { auth } from '@/auth';
import type { Actor } from '@vire/core/access';

export type CallerSource = 'session';

export interface Caller extends Actor {
  name: string | null;
  email: string | null;
  image: string | null;
  /** Чем аутентифицирован вызов. Bearer появится здесь, не у каждого потребителя. */
  source: CallerSource;
}

/**
 * Единственная точка получения актора для серверного кода. Сейчас оборачивает cookie-сессию
 * Auth.js один в один; Bearer-токен устройства добавится здесь, и потребители не изменятся.
 */
export async function getCaller(): Promise<Caller | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  return {
    id: user.id,
    role: user.role,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    source: 'session',
  };
}
