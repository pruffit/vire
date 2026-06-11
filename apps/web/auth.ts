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
import {
  db,
  findUserByEmail,
  findOrCreateTelegramUser,
  linkOAuthAccount,
  getUserById,
} from '@vire/db';
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
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

        const computed = createHmac('sha256', secretKey).update(checkString).digest('hex');
        if (computed !== hash) return null;

        if (Date.now() / 1000 - parseInt(data.auth_date ?? '0', 10) > 86400) return null;

        const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Telegram';
        const user = await findOrCreateTelegramUser(data.id, { name, photoUrl: data.photo_url || undefined });

        return { id: user.id, name, email: null, image: data.photo_url || null, role: user.role as UserRole };
      },
    }),

    // ── OAuth ─────────────────────────────────────────────────────────────
    // allowDangerousEmailAccountLinking — автосвязка когда email совпадает
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
    /**
     * Перехватываем OAuth-колбэк при намеренной привязке провайдера.
     * Cookie `vire_link_uid` выставляется в linkOAuthProvider() до signIn().
     * Переназначаем аккаунт целевому пользователю независимо от совпадения email.
     */
    async signIn({ user, account }) {
      if (account?.type !== 'oauth') return true;

      try {
        const jar = await cookies();
        const linkUid = jar.get('vire_link_uid')?.value;
        if (!linkUid) return true;

        const result = await linkOAuthAccount(linkUid, user.id, {
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
          id_token: account.id_token,
        });

        jar.delete('vire_link_uid');

        if (result === 'already_linked_to_other') {
          return '/profile?link_error=taken';
        }

        // Сигнал jwt-callback: вернуть токен исходного пользователя
        jar.set('vire_link_jwt_uid', linkUid, { maxAge: 60, httpOnly: true, sameSite: 'lax', path: '/' });
      } catch (e) {
        console.error('[auth:link:signIn]', e);
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        let uid = user.id as string;
        let role = user.role as UserRole;

        // При привязке провайдера восстанавливаем токен исходного пользователя
        if (account?.type === 'oauth') {
          try {
            const jar = await cookies();
            const linkUid = jar.get('vire_link_jwt_uid')?.value;
            if (linkUid) {
              const original = await getUserById(linkUid);
              if (original) {
                uid = original.id;
                role = original.role as UserRole;
              }
              jar.delete('vire_link_jwt_uid');
            }
          } catch {}
        }

        token.id = uid;
        token.role = role;
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
