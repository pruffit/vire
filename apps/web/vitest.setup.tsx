import { vi } from 'vitest';

// Dummy DATABASE_URL — иначе packages/db/src/client.ts бросает на импорте @vire/db;
// реальное соединение в юнит-тестах не открывается (vi.mock('@vire/db')).
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test_vitest';

// Дефолтный мок @/i18n/navigation: реальный next-intl Link/usePathname/useRouter
// требуют NextIntlClientProvider в дереве, которого в юнит-тестах компонентов нет
// ("No intl context found"). Тесты, которым нужны конкретные push/replace/refresh —
// переопределяют этим же vi.mock локально в своём файле (локальный побеждает).
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string | { pathname: string }; children?: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>{children}</a>
  ),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  redirect: (href: unknown) => {
    throw new Error(`redirect() called in test: ${JSON.stringify(href)}`);
  },
  getPathname: ({ href }: { href: string | { pathname: string } }) => (typeof href === 'string' ? href : href.pathname),
}));
