import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Yandex from 'next-auth/providers/yandex';
import Nodemailer from 'next-auth/providers/nodemailer';
import { sendMail } from '@/lib/mailer';
import { compare } from 'bcryptjs';
import { cookies } from 'next/headers';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, findUserByEmail, tryClaimOAuthAccount } from '@vire/db';
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
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        // Брутфорс-защита: лимит попыток входа по IP (Redis fixed-window).
        // Динамический импорт — чтобы ioredis не попадал в граф middleware.
        try {
          const { rateLimit, clientKey } = await import('@/lib/rate-limit');
          const rl = await rateLimit(clientKey(request as Request, 'login'), 30, 300);
          if (!rl.ok) return null;
        } catch { /* rate-limit недоступен — не блокируем вход */ }
        const user = await findUserByEmail(credentials.email as string);
        if (!user?.passwordHash) return null;
        const ok = await compare(credentials.password as string, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role as UserRole };
      },
    }),

    // ── OAuth ─────────────────────────────────────────────────────────────
    // Google и Telegram убраны: 406-ФЗ запрещает росс. сайтам использовать
    // иностранные сервисы авторизации. Остаётся email/пароль, magic-link и
    // Яндекс ID (росс. система). allowDangerousEmailAccountLinking нужен потому
    // что при вызове getUserByEmail мы возвращаем linking-пользователя.
    Yandex({ allowDangerousEmailAccountLinking: true }),
    Nodemailer({
      server: 'smtp://localhost:25', // не используется — sendVerificationRequest переопределён
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
