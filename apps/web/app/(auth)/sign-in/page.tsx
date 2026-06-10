import { signIn } from '@/auth';
import { Button, Card, CardContent, Input } from '@vire/ui';

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return (
    <main className="relative min-h-full flex items-center justify-center p-8 overflow-hidden">
      {/* Тёплое свечение за карточкой — собирает взгляд в центре пустой страницы */}
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
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h1 className="text-2xl font-bold tracking-tight text-center">Войти</h1>

            <form
              action={async () => {
                'use server';
                const { callbackUrl } = await searchParams;
                await signIn('yandex', { redirectTo: callbackUrl ?? '/' });
              }}
            >
              <Button type="submit" className="w-full">
                Продолжить с Яндексом
              </Button>
            </form>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">или по почте</span>
              </div>
            </div>

            <form
              action={async (data: FormData) => {
                'use server';
                const { callbackUrl } = await searchParams;
                await signIn('resend', {
                  email: data.get('email'),
                  redirectTo: callbackUrl ?? '/',
                });
              }}
              className="flex flex-col gap-2"
            >
              <Input
                type="email"
                name="email"
                placeholder="you@example.ru"
                required
                autoComplete="email"
              />
              <Button type="submit" size="sm" variant="secondary" className="w-full">
                Отправить ссылку
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Пришлём ссылку для входа, пароль не нужен.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
