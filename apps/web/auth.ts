import NextAuth, { type DefaultSession } from 'next-auth';
import Yandex from 'next-auth/providers/yandex';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@vire/db';
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
    Yandex,
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
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
  },
});
