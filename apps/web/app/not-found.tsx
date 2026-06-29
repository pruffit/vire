import Link from 'next/link';
import { Eyebrow, GlowBackdrop, FeatureCard, PillLink } from '@/components/content-kit';

export default function NotFound() {
  return (
    <main className="min-h-full flex flex-col items-center justify-center gap-8 px-6 py-20 text-center">
      <div className="relative flex items-center justify-center px-20 py-8 animate-fade-up">
        <GlowBackdrop />
        <p
          aria-hidden="true"
          className="font-mono font-black leading-none select-none tracking-tighter text-primary/20"
          style={{ fontSize: 'clamp(5rem, 18vw, 10rem)' }}
        >
          404
        </p>
      </div>

      <div className="space-y-3 -mt-4 animate-fade-up">
        <Eyebrow>Ошибка 404</Eyebrow>
        <h1 className="text-2xl font-bold tracking-tight">Страница не найдена</h1>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
          Возможно, ссылка устарела или страница была удалена.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-3 animate-fade-up">
        <PillLink href="/" tone="primary" icon="home">На главную</PillLink>
        <PillLink href="/search" tone="outline" icon="search">Поиск</PillLink>
        <PillLink href="/artists" tone="outline" icon="users">Артисты</PillLink>
      </div>

      <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3 animate-fade-up">
        <Link href="/releases" className="block">
          <FeatureCard icon="music" title="Релизы">Слушать новое</FeatureCard>
        </Link>
        <Link href="/artists" className="block">
          <FeatureCard icon="users" title="Артисты">Каталог исполнителей</FeatureCard>
        </Link>
        <Link href="/search" className="block">
          <FeatureCard icon="search" title="Поиск">Найти трек или артиста</FeatureCard>
        </Link>
      </div>
    </main>
  );
}
