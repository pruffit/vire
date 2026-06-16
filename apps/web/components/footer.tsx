import Link from 'next/link';
import { Logo } from './logo';
import { NoticeReopenLink } from './compliance-notice';
import { SITE_VERSION } from '@/lib/site';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          {/* Бренд */}
          <div className="max-w-xs space-y-3">
            <Logo className="h-4 w-auto text-foreground/80" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Независимая музыкальная площадка для артистов и слушателей СНГ.
            </p>
          </div>

          {/* Ссылки */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12">
            <FooterCol title="Площадка">
              <FooterLink href="/artists">Артисты</FooterLink>
              <FooterLink href="/feedback">Стать артистом</FooterLink>
            </FooterCol>
            <FooterCol title="Поддержка">
              <FooterLink href="/feedback">Обратная связь</FooterLink>
            </FooterCol>
            <FooterCol title="Правовое">
              <FooterLink href="/terms">Условия</FooterLink>
              <FooterLink href="/privacy">Конфиденциальность</FooterLink>
              <li>
                <NoticeReopenLink className="text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer text-left" />
              </li>
              <FooterLink href="/design">Дизайн</FooterLink>
            </FooterCol>
          </div>
        </div>

        {/* Нижняя полоса */}
        <div className="mt-10 flex items-center gap-2 border-t border-border/60 pt-6">
          <span className="font-mono text-xs text-muted-foreground">© {year} Vire</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono text-xs text-muted-foreground/60">v{SITE_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-foreground/40">
        {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('mailto:');
  const cn = 'text-xs text-muted-foreground transition-colors hover:text-foreground';
  return (
    <li>
      {external ? (
        <a href={href} className={cn}>{children}</a>
      ) : (
        <Link href={href} className={cn}>{children}</Link>
      )}
    </li>
  );
}
