import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { users, accounts } from '../schema';

export interface UserWithPassword {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  passwordHash: string | null;
  role: string;
  emailVerified: Date | null;
}

export interface LinkedProvider {
  provider: string;
  providerAccountId: string;
}

/** Найти пользователя по email — включает passwordHash для Credentials auth. */
export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      passwordHash: users.passwordHash,
      role: users.role,
      emailVerified: users.emailVerified,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return row ?? null;
}

/** Создать нового пользователя с хешем пароля (email/password регистрация). */
export async function createUserWithPassword(opts: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<{ id: string }> {
  const [row] = await db
    .insert(users)
    .values({
      email: opts.email,
      name: opts.name,
      passwordHash: opts.passwordHash,
      emailVerified: new Date(),
    })
    .returning({ id: users.id });
  return row;
}

/** Установить пароль для существующего пользователя. */
export async function setUserPasswordHash(userId: string, hash: string): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Получить список привязанных OAuth-провайдеров для пользователя. */
export async function getUserLinkedProviders(userId: string): Promise<LinkedProvider[]> {
  const rows = await db
    .select({ provider: accounts.provider, providerAccountId: accounts.providerAccountId })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  return rows;
}

export interface TelegramProfile {
  name: string;
  photoUrl?: string;
}

export interface UserAuthInfo {
  hasPassword: boolean;
  providers: LinkedProvider[];
}

/**
 * Найти существующего Telegram-пользователя по telegramId или создать нового.
 * Создаёт запись в accounts (provider='telegram') для последующей проверки
 * в разделе «Способы входа» в профиле.
 */
export async function findOrCreateTelegramUser(
  telegramId: string,
  profile: TelegramProfile,
): Promise<{ id: string; role: string }> {
  const [existing] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(
      and(eq(accounts.provider, 'telegram'), eq(accounts.providerAccountId, telegramId)),
    )
    .limit(1);

  if (existing) {
    const [user] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);
    return user;
  }

  const [newUser] = await db
    .insert(users)
    .values({ name: profile.name, image: profile.photoUrl ?? null, emailVerified: new Date() })
    .returning({ id: users.id, role: users.role });

  await db.insert(accounts).values({
    userId: newUser.id,
    type: 'oauth',
    provider: 'telegram',
    providerAccountId: telegramId,
  });

  return newUser;
}

/** Возвращает способы входа: есть ли пароль + список OAuth-провайдеров. */
export async function getUserAuthInfo(userId: string): Promise<UserAuthInfo> {
  const [userRow] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const providers = await getUserLinkedProviders(userId);

  return {
    hasPassword: !!userRow?.passwordHash,
    providers,
  };
}
