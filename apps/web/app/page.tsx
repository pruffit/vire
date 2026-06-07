import Link from 'next/link';
import { Stagger, StaggerItem } from '@vire/ui/motion';
import { auth } from '@/auth';
import { GlobalSearch } from '@/components/global-search';

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-6 pb-24">
      <Stagger step={0.08} className="flex flex-col items-center gap-10">
        <StaggerItem className="text-center space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">Vire</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Независимая музыкальная площадка для артистов и слушателей СНГ
          </p>
        </StaggerItem>

        <StaggerItem className="w-full flex justify-center">
          <GlobalSearch variant="hero" />
        </StaggerItem>

        <StaggerItem className="flex items-center gap-4 text-sm">
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
        </StaggerItem>
      </Stagger>
    </main>
  );
}
