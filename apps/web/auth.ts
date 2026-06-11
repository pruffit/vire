import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Yandex from 'next-auth/providers/yandex';
import Google from 'next-auth/providers/google';
import VK from 'next-auth/providers/vk';
import Resend from 'next-auth/providers/resend';
import { compare } from 'bcryptjs';
import { createHash, createHmac } from 'crypto';
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
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
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
        id: { type: 'text' },
        first_name: { type: 'text' },
        last_name: { type: 'text' },
        username: { type: 'text' },
        photo_url: { type: 'text' },
        auth_date: { type: 'text' },
        hash: { type: 'text' },
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

        const authDate = parseInt(data.auth_date ?? '0', 10);
        if (Date.now() / 1000 - authDate > 86400) return null;

        const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Telegram';
        const user = await findOrCreateTelegramUser(data.id, {
          name,
          photoUrl: data.photo_url || undefined,
        });

        return {
          id: user.id,
          name,
          email: null,
          image: data.photo_url || null,
          role: user.role as UserRole,
        };
      },
    }),

    // ── OAuth ─────────────────────────────────────────────────────────────
    Yandex,
    Google,
    VK,
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM ?? 'onboarding@resend.dev',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
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
