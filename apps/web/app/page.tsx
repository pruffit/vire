import { auth, signOut } from '@/auth';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@vire/ui';

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Vire</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Независимая музыкальная площадка для артистов и слушателей СНГ.
          </p>
          {session ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                {session.user.name ?? session.user.email}
                <span className="ml-2 text-xs text-muted-foreground">
                  {session.user.role}
                </span>
              </p>
              <form
                action={async () => {
                  'use server';
                  await signOut({ redirectTo: '/' });
                }}
              >
                <Button size="sm" variant="ghost" type="submit">
                  Выйти
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="link" asChild>
                <a href="/sign-in">Войти</a>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href="/artists">Обзор</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
