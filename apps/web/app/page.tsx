import Link from 'next/link';
import { auth } from '@/auth';
import { GlobalSearch } from '@/components/global-search';

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 gap-10 animate-fade-up">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Vire</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Независимая музыкальная площадка для артистов и слушателей СНГ
        </p>
      </div>

      <GlobalSearch variant="hero" />

      <div className="flex items-center gap-4 text-sm">
        <Link
          href="/artists"
          className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Каталог артистов
        </Link>
        {session ? (
          <Link
            href="/feed"
            className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Лента
          </Link>
        ) : (
          <Link
            href="/sign-in"
            className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Войти
          </Link>
        )}
      </div>
    </main>
  );
}
