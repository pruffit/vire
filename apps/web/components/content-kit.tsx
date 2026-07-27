import Link from 'next/link';
import { cn } from '@vire/ui';
import { Reveal } from '@vire/ui/motion';
import { Icon, type IconName } from '@/components/icon';
import { LegalToc } from '@/components/legal-toc';

/**
 * Content-kit — словарь публичных/контентных поверхностей (о платформе, правовые
 * страницы, 404, анонсы). Маркетинговый регистр (акцент `primary`), в отличие от
 * продуктового `ui-kit.tsx`.
 */

/** Радиальное свечение акцентом. `corner` — из левого-верхнего угла (для hover-карточек). */
export function GlowBackdrop({ className, corner = false }: { className?: string; corner?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10', className)}
      style={{
        background: corner
          ? 'radial-gradient(ellipse 70% 90% at 0% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent)'
          : 'radial-gradient(ellipse 60% 130% at 85% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent)',
      }}
    />
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground', className)}>
      {children}
    </p>
  );
}

export function StatusPill({ children, dot = true }: { children: React.ReactNode; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-mono uppercase tracking-widest text-muted-foreground">
      {dot && <span className="size-1.5 rounded-full bg-primary animate-pulse" />}
      {children}
    </span>
  );
}

/** Server-компонент (вход на CSS animate-fade-up, не motion). */
export function ContentHero({
  eyebrow,
  badge,
  title,
  subtitle,
  glow = false,
  size = 'lg',
  align = 'left',
  actions,
}: {
  eyebrow?: React.ReactNode;
  /** Произвольный значок над заголовком (напр. StatusPill). Перебивает eyebrow. */
  badge?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  glow?: boolean;
  size?: 'lg' | 'md';
  align?: 'left' | 'center';
  actions?: React.ReactNode;
}) {
  return (
    <header className={cn('relative space-y-5 animate-fade-up', align === 'center' && 'text-center')}>
      {glow && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 -z-10 h-72 w-[130%] -translate-x-1/2 opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(ellipse 50% 60% at 50% 0%, color-mix(in oklch, var(--primary) 32%, transparent), transparent)' }}
        />
      )}
      {badge ?? (eyebrow && <Eyebrow>{eyebrow}</Eyebrow>)}
      <h1
        className={cn(
          'font-bold tracking-tight text-balance leading-[1.02]',
          size === 'lg' ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-4xl',
        )}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className={cn(
            'text-base sm:text-lg text-muted-foreground leading-relaxed max-w-prose',
            align === 'center' && 'mx-auto',
          )}
        >
          {subtitle}
        </p>
      )}
      {actions && (
        <div className={cn('flex flex-wrap gap-3 pt-1', align === 'center' && 'justify-center')}>
          {actions}
        </div>
      )}
    </header>
  );
}

export function NumberedSection({
  index,
  title,
  subtitle,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <section className="space-y-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-medium tracking-widest text-primary">{index}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </section>
    </Reveal>
  );
}

export function FeatureCard({
  icon,
  title,
  children,
  className,
}: {
  icon: IconName;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-xl border border-border bg-card p-4 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/40',
        className,
      )}
    >
      <GlowBackdrop corner className="opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background transition-colors group-hover:border-primary/50 group-hover:bg-primary/10">
          <Icon name={icon} size={18} className="text-primary" />
        </span>
        <h3 className="text-sm font-medium leading-snug">{title}</h3>
      </div>
      {children && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{children}</p>}
    </div>
  );
}

export function PillLink({
  href,
  tone = 'primary',
  icon,
  external,
  children,
}: {
  href: string;
  tone?: 'primary' | 'outline';
  icon?: IconName;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors',
        tone === 'primary'
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-border hover:bg-foreground/5',
      )}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </Link>
  );
}

export interface LegalSection {
  /** Краткий заголовок (для TOC и шапки секции). */
  title: string;
  body: React.ReactNode;
}

/**
 * Правовая страница (условия/конфиденциальность): hero + липкое оглавление на
 * десктопе (scroll-spy) + нумерованные секции-якоря. Контент задаётся данными —
 * обе страницы дробятся на массив секций без дублирования вёрстки.
 */
export function LegalDoc({
  eyebrow = 'VireMusic · Правовое',
  title,
  revision,
  intro,
  sections,
}: {
  eyebrow?: string;
  title: string;
  revision: string;
  intro?: React.ReactNode;
  sections: LegalSection[];
}) {
  const toc = sections.map((s, i) => ({ id: `s-${i + 1}`, n: i + 1, title: s.title }));

  return (
    <main className="mx-auto min-h-full max-w-4xl px-6 py-14 sm:py-20">
      <ContentHero
        eyebrow={eyebrow}
        title={title}
        size="md"
        glow
        subtitle={
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 font-mono text-xs">
              <Icon name="clock" size={12} className="text-primary" />
              {revision}
            </span>
            <span className="text-muted-foreground/60">драфт — не юридическая консультация</span>
          </span>
        }
      />

      {intro && <p className="mt-8 max-w-prose text-sm leading-relaxed text-muted-foreground">{intro}</p>}

      <div className="mt-12 lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-12">
        <LegalToc items={toc} />
        <div className="space-y-12">
          {sections.map((s, i) => (
            <section key={toc[i].id} id={toc[i].id} className="scroll-mt-24 space-y-3">
              <h2 className="flex items-baseline gap-3 text-base font-semibold text-foreground">
                <span className="font-mono text-xs text-primary tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.title}
              </h2>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:opacity-70 [&_a]:transition-opacity [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
