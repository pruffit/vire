import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Yandex from 'next-auth/providers/yandex';
import Google from 'next-auth/providers/google';
import VK from 'next-auth/providers/vk';
import Resend from 'next-auth/providers/resend';
import { compare } from 'bcryptjs';
import { createHash, createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, findUserByEmail, findOrCreateTelegramUser } from '@vire/db';
import { accounts, sessions, verificationTokens, users } from '@vire/db/schema';

export type UserRole = 'LISTENER' | 'ARTIST' | 'MODERATOR' | 'ADMIN' | 'SUPERADMIN';

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: UserRole } & DefaultSession['user'];
  }
  interface User {
    role: UserRole;
  }
}

/**
 * Адаптер с поддержкой привязки провайдеров.
 *
 * Проблема: Auth.js бросает OAuthAccountNotLinked ещё до вызова signIn-callback,
 * если у пользователя другой email или другой провайдер.
 *
 * Решение: когда выставлена cookie `vire_link_uid`, перекрываем getUserByEmail —
 * возвращаем текущего (linking) пользователя вместо поиска по email.
 * Auth.js видит «пользователь найден по email» → вызывает linkAccount → привязывает.
 */
function createAdapter() {
  const base = DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });

  return {
    ...base,
    getUserByEmail: async (email: string) => {
      try {
        const jar = await cookies();
        const linkUid = jar.get('vire_link_uid')?.value;
        if (linkUid && base.getUser) {
          return await base.getUser(linkUid);
        }
      } catch {}
      return base.getUserByEmail?.(email) ?? null;
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapter(),
  providers: [
    // ── Email / пароль ────────────────────────────────────────────────────
    Credentials({
      id: 'credentials',
      credentials: { email: { type: 'email' }, password: { type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await findUserByEmail(credentials.email as string);
        if (!user?.passwordHash) return null;
        const ok = await compare(credentials.password as string, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role as UserRole };
      },
    }),

    // ── Telegram Login Widget ─────────────────────────────────────────────
    Credentials({
      id: 'telegram',
      name: 'Telegram',
      credentials: {
        id: {}, first_name: {}, last_name: {}, username: {},
        photo_url: {}, auth_date: {}, hash: {},
      },
      async authorize(credentials) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) return null;
        const creds = credentials as Record<string, string | undefined>;
        const { hash, ...data } = creds;
        if (!hash || !data.id) return null;
        const secretKey = createHash('sha256').update(botToken).digest();
        const checkString = Object.entries(data)
          .filter(([, v]) => v !== undefined && v !== '')
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('\n');
        if (createHmac('sha256', secretKey).update(checkString).digest('hex') !== hash) return null;
        if (Date.now() / 1000 - parseInt(data.auth_date ?? '0', 10) > 86400) return null;
        const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Telegram';
        const user = await findOrCreateTelegramUser(data.id, { name, photoUrl: data.photo_url || undefined });
        return { id: user.id, name, email: null, image: data.photo_url || null, role: user.role as UserRole };
      },
    }),

    // ── OAuth ─────────────────────────────────────────────────────────────
    // allowDangerousEmailAccountLinking нужен потому что при вызове getUserByEmail
    // мы возвращаем linking-пользователя (который мог быть создан через другой провайдер)
    Yandex({ allowDangerousEmailAccountLinking: true }),
    Google({ allowDangerousEmailAccountLinking: true }),
    VK({ allowDangerousEmailAccountLinking: true }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.type !== 'oauth') return true;
      try {
        const jar = await cookies();
        const linkUid = jar.get('vire_link_uid')?.value;
        if (!linkUid) return true;
        jar.delete('vire_link_uid');
        // Аккаунт принадлежит другому пользователю (getUserByAccount нашёл его раньше нас)
        if (user.id && user.id !== linkUid) return '/profile?link_error=taken';
      } catch (e) {
        console.error('[auth:link]', e);
      }
      return true;
    },

    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as UserRole;
      }
      return token;
    },

    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
    verifyRequest: '/sign-in?sent=1',
  },
});
