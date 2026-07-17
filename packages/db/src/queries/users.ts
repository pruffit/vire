import { and, count, eq } from 'drizzle-orm';
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

/** Найти пользователя по email, включает passwordHash для Credentials auth. */
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

export async function setUserPasswordHash(userId: string, hash: string): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: hash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

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
 * Если передан linkUserId, привязать Telegram к существующему пользователю
 * вместо создания нового. Возвращает null при конфликте (уже занят другим юзером).
 */
export async function findOrCreateTelegramUser(
  telegramId: string,
  profile: TelegramProfile,
  linkUserId?: string,
): Promise<{ id: string; role: string; name: string | null; image: string | null } | null> {
  const userCols = { id: users.id, role: users.role, name: users.name, image: users.image };

  const [existing] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(
      and(eq(accounts.provider, 'telegram'), eq(accounts.providerAccountId, telegramId)),
    )
    .limit(1);

  if (existing) {
    // Telegram уже привязан к другому пользователю: конфликт при линковке
    if (linkUserId && existing.userId !== linkUserId) return null;
    const [user] = await db
      .select(userCols)
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);
    return user ?? null;
  }

  // Привязать Telegram к уже существующему пользователю, не трогаем его имя/аватар
  if (linkUserId) {
    const [user] = await db
      .select(userCols)
      .from(users)
      .where(eq(users.id, linkUserId))
      .limit(1);
    if (user) {
      await db.insert(accounts).values({
        userId: linkUserId,
        type: 'oauth',
        provider: 'telegram',
        providerAccountId: telegramId,
      });
      return user;
    }
  }

  const [newUser] = await db
    .insert(users)
    .values({ name: profile.name, image: profile.photoUrl ?? null, emailVerified: new Date() })
    .returning(userCols);

  await db.insert(accounts).values({
    userId: newUser.id,
    type: 'oauth',
    provider: 'telegram',
    providerAccountId: telegramId,
  });

  return newUser;
}

export type LinkAccountResult = 'ok' | 'already_linked_to_other';

export interface OAuthAccountData {
  type: string;
  provider: string;
  providerAccountId: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
}

/**
 * Привязать OAuth-аккаунт к существующему пользователю. Вызывается из Auth.js
 * signIn callback; oauthUserId - пользователь, которого уже создал DrizzleAdapter для OAuth.
 */
export async function linkOAuthAccount(
  targetUserId: string,
  oauthUserId: string | undefined,
  account: OAuthAccountData,
): Promise<LinkAccountResult> {
  const [existing] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(
      eq(accounts.provider, account.provider),
      eq(accounts.providerAccountId, account.providerAccountId),
    ))
    .limit(1);

  if (existing?.userId === targetUserId) {
    return 'ok';
  }

  if (existing && existing.userId !== oauthUserId) {
    return 'already_linked_to_other';
  }

  if (existing) {
    // DrizzleAdapter создал аккаунт для OAuth-пользователя, переназначаем владельца
    await db
      .update(accounts)
      .set({ userId: targetUserId })
      .where(and(
        eq(accounts.provider, account.provider),
        eq(accounts.providerAccountId, account.providerAccountId),
      ));
  } else {
    await db.insert(accounts).values({
      userId: targetUserId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      access_token: account.access_token ?? null,
      refresh_token: account.refresh_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
    });
  }

  // Если Auth.js создал временного пользователя только для этого OAuth, удаляем его
  if (oauthUserId && oauthUserId !== targetUserId) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(accounts)
      .where(eq(accounts.userId, oauthUserId));
    if (Number(total) === 0) {
      await db.delete(users).where(eq(users.id, oauthUserId));
    }
  }

  return 'ok';
}

/**
 * Забрать OAuth-аккаунт у другого пользователя (артефакт неудачной попытки привязки)
 * и отдать targeting-пользователю. Безопасно только из OAuth-callback: успешный
 * редирект провайдера подтверждает реальное владение. Прежнего владельца без
 * остальных аккаунтов и без пароля удаляем.
 */
export async function tryClaimOAuthAccount(
  provider: string,
  providerAccountId: string,
  targetUserId: string,
  currentOwnerId: string,
): Promise<boolean> {
  await db
    .update(accounts)
    .set({ userId: targetUserId })
    .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)));

  // Удалить старого пользователя если он остался без аккаунтов и без пароля
  const [{ cnt }] = await db
    .select({ cnt: count() })
    .from(accounts)
    .where(eq(accounts.userId, currentOwnerId));

  if (Number(cnt) === 0) {
    const [old] = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, currentOwnerId))
      .limit(1);
    if (old && old.passwordHash === null) {
      await db.delete(users).where(eq(users.id, currentOwnerId));
    }
  }

  return true;
}

/** Найти пользователя по ID, для jwt callback при привязке аккаунта. */
export async function getUserById(
  userId: string,
): Promise<{ id: string; role: string } | null> {
  const [row] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
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
