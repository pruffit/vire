import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Yandex from 'next-auth/providers/yandex';
import Google from 'next-auth/providers/google';
import Nodemailer from 'next-auth/providers/nodemailer';
import { sendMail } from '@/lib/mailer';
import { compare } from 'bcryptjs';
import { createHash, createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, findUserByEmail, findOrCreateTelegramUser, tryClaimOAuthAccount } from '@vire/db';
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
    // Если Google-аккаунт был ранее прилинкован к ghost-пользователю
    // (предыдущая неудачная попытка привязки) — забираем его у ghost'а.
    getUserByAccount: async (providerAccount: Parameters<NonNullable<typeof base.getUserByAccount>>[0]) => {
      const found = await base.getUserByAccount!(providerAccount);
      if (!found) return null;
      try {
        const jar = await cookies();
        const linkUid = jar.get('vire_link_uid')?.value;
        if (linkUid && found.id !== linkUid) {
          const claimed = await tryClaimOAuthAccount(
            providerAccount.provider,
            providerAccount.providerAccountId,
            linkUid,
            found.id,
          );
          if (claimed && base.getUser) return base.getUser(linkUid);
        }
      } catch (e) {
        console.error('[auth:link:getUserByAccount]', e);
      }
      return found;
    },
    getUserByEmail: async (email: string) => {
      try {
        const jar = await cookies();
        const linkUid = jar.get('vire_link_uid')?.value;
        if (linkUid && base.getUser) {
          return await base.getUser(linkUid);
        }
      } catch {
        // нет cookie-привязки — падаем на обычный поиск по email
      }
      return base.getUserByEmail?.(email) ?? null;
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAdapter(),
  trustHost: true,
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
    Nodemailer({
      server: process.env.SMTP_HOST
        ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: false,
            auth: { user: process.env.SMTP_LOGIN, pass: process.env.SMTP_PASSWORD } }
        : 'smtp://localhost:587',
      from: process.env.SMTP_FROM ?? 'Vire <noreply@viremusic.ru>',
      async sendVerificationRequest({ identifier, url }) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`\n[auth] Magic link for ${identifier}:\n${url}\n`);
          return;
        }
        await sendMail({
          to: identifier,
          subject: 'Ссылка для входа в Vire',
          text: `Твоя ссылка для входа в Vire:\n\n${url}\n\nДействительна 24 часа.`,
        });
      },
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
