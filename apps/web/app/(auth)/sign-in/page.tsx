import { signIn } from '@/auth';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@vire/ui';

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return (
    <main className="min-h-full flex items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Войти в Vire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            action={async () => {
              'use server';
              const { callbackUrl } = await searchParams;
              await signIn('yandex', { redirectTo: callbackUrl ?? '/' });
            }}
          >
            <Button type="submit" variant="secondary" className="w-full">
              Яндекс
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
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
