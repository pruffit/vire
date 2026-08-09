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

// render() из @testing-library/react оборачивается в NextIntlClientProvider с реальными
// ru-словарями — компоненты на useTranslations() рендерят тот же русский текст, что и до
// локализации, старые ассерты на строки продолжают проходить без переписывания тестов.
vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@testing-library/react')>();
  const { NextIntlClientProvider } = await import('next-intl');
  const { getMessages } = await import('@vire/i18n/messages');
  const messages = await getMessages('ru');
  const wrap = (ui: React.ReactElement) => (
    <NextIntlClientProvider locale="ru" messages={messages}>{ui}</NextIntlClientProvider>
  );
  return {
    ...actual,
    // rerender() тоже оборачивается — иначе повторный рендер без провайдера меняет тип
    // корневого элемента, React размонтирует поддерево целиком и теряет локальный state.
    render: (ui: React.ReactElement, options?: Parameters<typeof actual.render>[1]) => {
      const result = actual.render(wrap(ui), options);
      return {
        ...result,
        rerender: (nextUi: React.ReactElement) => result.rerender(wrap(nextUi)),
      };
    },
  };
});

// getTranslations/getLocale из next-intl/server опираются на AsyncLocalStorage запроса
// Next.js, которого в юнит-тестах нет ("no request found") — серверные компоненты,
// вызываемые напрямую (не через render()), получают переводчик на реальных ru-словарях.
vi.mock('next-intl/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl/server')>();
  const { getTranslator } = await import('@vire/i18n/translator');
  return {
    ...actual,
    getLocale: async () => 'ru' as const,
    setRequestLocale: () => {},
    getTranslations: async (namespace?: string | { namespace?: string }) =>
      getTranslator('ru', typeof namespace === 'string' ? namespace : namespace?.namespace),
  };
});
