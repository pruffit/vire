import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-full flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-8xl font-bold font-mono tabular-nums" style={{ opacity: 0.08 }}>
        404
      </p>
      <div className="space-y-2 -mt-4">
        <h1 className="text-xl font-semibold tracking-tight">Страница не найдена</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Возможно, ссылка устарела или страница была удалена.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          На главную
        </Link>
        <Link
          href="/artists"
          className="px-4 py-2 rounded-full bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          Артисты
        </Link>
      </div>
    </main>
  );
}
