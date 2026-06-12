import type { Metadata } from 'next';
import { AuthForms } from './auth-forms';

export const metadata: Metadata = {
  title: 'Войти',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; sent?: string }>;
}) {
  const { callbackUrl, sent } = await searchParams;
  const redirectTo = callbackUrl ?? '/';

  return (
    <main className="relative min-h-full flex items-center justify-center p-8 overflow-hidden">
      {/* Тёплое свечение за карточкой */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 640px 480px at 50% 42%, oklch(0.32 0.045 75 / 0.32), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-up">
        <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground mb-4 text-center">
          Vire
        </p>

        <div className="rounded-xl border border-border bg-card shadow-xl shadow-black/20 p-6">
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <p className="text-3xl">📬</p>
              <h1 className="text-xl font-semibold">Письмо отправлено</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Проверь почту — там ссылка для входа. Если не видишь, загляни в спам.
              </p>
            </div>
          ) : (
            <AuthForms
              callbackUrl={redirectTo}
              telegramBotUsername={
                process.env.TELEGRAM_BOT_USERNAME ??
                process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ??
                ''
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
