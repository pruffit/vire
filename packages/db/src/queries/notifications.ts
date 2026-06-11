import { eq } from 'drizzle-orm';
import { db } from '../client';
import { follows, users } from '../schema';

export interface FollowerEmail {
  email: string;
  name: string | null;
}

export async function getFollowerEmails(artistProfileId: string): Promise<FollowerEmail[]> {
  const rows = await db
    .select({ email: users.email, name: users.name })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.userId))
    .where(eq(follows.artistProfileId, artistProfileId));

  // Telegram-пользователи не имеют email — их пропускаем для рассылок
  return rows.filter((r): r is FollowerEmail => r.email !== null);
}
