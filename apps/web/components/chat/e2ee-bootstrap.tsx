'use client';

import { useIdentity } from '@/lib/e2ee-client';

// Публикует ikPub при любом заходе залогиненного юзера, не только на /messages —
// иначе собеседник не открывавший чат не имеет ключа и получить сообщение не может.
export function E2eeBootstrap({ userId }: { userId: string }) {
  useIdentity(userId);
  return null;
}
