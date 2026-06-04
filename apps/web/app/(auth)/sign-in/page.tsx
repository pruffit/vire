import { signIn } from '@/auth';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@vire/ui';

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Войти в Vire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Для продолжения выберите способ входа.
          </p>
          <form
            action={async () => {
              'use server';
              const { callbackUrl } = await searchParams;
              await signIn('google', { redirectTo: callbackUrl ?? '/' });
            }}
          >
            <Button type="submit" className="w-full">
              Войти через Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
