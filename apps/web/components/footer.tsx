import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-white/5 bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          {/* Лого + копирайт */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight">Vire</span>
            <span className="text-xs text-white/20">·</span>
            <span className="text-xs text-white/30 font-mono">© {year}</span>
          </div>

          {/* Навигация */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/40">
            <Link href="/terms" className="hover:text-white/70 transition-colors">
              Условия
            </Link>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">
              Конфиденциальность
            </Link>
            <a href="mailto:hello@vire.ru" className="hover:text-white/70 transition-colors">
              hello@vire.ru
            </a>
            <Link
              href="/sign-in"
              className="hover:text-white/70 transition-colors"
            >
              Для артистов →
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
