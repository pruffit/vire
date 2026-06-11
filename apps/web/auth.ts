import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Yandex from 'next-auth/providers/yandex';
import Resend from 'next-auth/providers/resend';
import { compare } from 'bcryptjs';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, findUserByEmail } from '@vire/db';
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
    Credentials({
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
    verifyRequest: '/sign-in?sent=1',
  },
});
