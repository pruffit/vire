import Link from 'next/link';
import * as React from 'react';
import { cn } from '@vire/ui';

/**
 * Admin UI kit — единый словарь backoffice.
 *
 * Принципы (Impeccable / product-регистр):
 * - Нейтраль через `foreground`-альфу, НЕ `white/X` — сохраняет тёплую подкраску
 *   платформы (hue 75). Один масштаб прозрачностей на всю админку.
 * - Плотность и точность: mono для данных и меток, tabular-nums для чисел.
 * - У каждого интерактива есть hover/focus/active; статусы — бейджи, не цветной текст.
 *
 * Всё презентационное и server-совместимое (без хуков/обработчиков).
 */

// ─── Neutral scale ───────────────────────────────────────────────────────────
// Единые роли цвета текста поверх тёмного фона.
export const ink = {
  /** Основной текст. */
  base: 'text-foreground',
  /** Вторичный (значения в ячейках, подписи). */
  soft: 'text-foreground/65',
  /** Метки, неактивное. */
  muted: 'text-foreground/45',
  /** Мета, едва заметное (id, даты-вспомогалки). */
  faint: 'text-foreground/30',
} as const;

/**
 * Класс для инлайн-контролов в таблицах (нативные `<select>`): единый вид для
 * смены роли/статуса. Строка, не компонент — годится и для client-компонентов.
 */
export const selectClass =
  'rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 font-mono text-xs transition-colors hover:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40';

/** Класс текстового поля/textarea/select в формах админки. Ширину задаёт вызов. */
export const fieldClass =
  'rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm transition-colors placeholder:text-foreground/35 focus:outline-none focus:ring-1 focus:ring-ring focus:border-foreground/20';

// ─── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {count !== undefined && (
          <span className="font-mono text-xs text-foreground/40 tabular-nums">
            {count.toLocaleString('ru-RU')}
          </span>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// ─── Detail header (страницы редактирования) ─────────────────────────────────

export function DetailHeader({
  backHref,
  backLabel,
  title,
  subtitle,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-foreground/45 hover:text-foreground transition-colors"
      >
        ← {backLabel}
      </Link>
      <h1 className="text-lg font-semibold tracking-tight mt-2">{title}</h1>
      {subtitle && <p className="mt-1 font-mono text-xs text-foreground/30">{subtitle}</p>}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/40">
      {children}
    </p>
  );
}

export function Section({
  label,
  action,
  children,
  className,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{label}</SectionLabel>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-foreground/10 bg-foreground/[0.025]', className)}>
      {children}
    </div>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function MetricGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-3', className)}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  href,
  dot,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
  /** Статус-точка слева от метки (для health-карточек). */
  dot?: 'ok' | 'error' | 'warn' | 'none';
}) {
  const inner = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-foreground/45">
        {dot && dot !== 'none' && (
          <span
            aria-hidden="true"
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              dot === 'ok' && 'bg-emerald-400',
              dot === 'error' && 'bg-red-400',
              dot === 'warn' && 'bg-amber-400',
            )}
          />
        )}
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums leading-none mt-0.5">
        {typeof value === 'number' ? value.toLocaleString('ru-RU') : value}
      </span>
      {sub && <span className="text-xs text-foreground/35 leading-snug">{sub}</span>}
    </>
  );
  const base =
    'rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 flex flex-col gap-1';
  return href ? (
    <Link
      href={href}
      className={cn(
        base,
        'transition-colors hover:bg-foreground/[0.06] hover:border-foreground/20',
      )}
    >
      {inner}
    </Link>
  ) : (
    <div className={base}>{inner}</div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warn'
  | 'error'
  | 'info'
  | 'accent';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-foreground/[0.08] text-foreground/70',
  success: 'bg-emerald-500/15 text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-300',
  error: 'bg-red-500/15 text-red-300',
  info: 'bg-sky-500/15 text-sky-300',
  accent: 'bg-orange-500/15 text-orange-300',
};

const BADGE_DOT: Record<BadgeTone, string> = {
  neutral: 'bg-foreground/40',
  success: 'bg-emerald-400',
  warn: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-sky-400',
  accent: 'bg-orange-400',
};

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[11px] leading-none whitespace-nowrap',
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', BADGE_DOT[tone])} />}
      {children}
    </span>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function Table({
  minWidth = 'min-w-[640px]',
  children,
  className,
}: {
  /** Tailwind min-w-[…] для горизонтального скролла на узких экранах. */
  minWidth?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 overflow-x-auto">
      <table className={cn('w-full text-sm', minWidth, className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-foreground/10">{children}</tr>
    </thead>
  );
}

export function Th({
  align = 'left',
  className,
  children,
}: {
  align?: 'left' | 'right' | 'center';
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-foreground/40',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Tr({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        'border-b border-foreground/[0.06] last:border-0 transition-colors hover:bg-foreground/[0.03]',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Td({
  align = 'left',
  tone = 'base',
  mono = false,
  nums = false,
  nowrap = false,
  className,
  children,
  colSpan,
}: {
  align?: 'left' | 'right' | 'center';
  tone?: 'base' | 'soft' | 'muted' | 'faint';
  mono?: boolean;
  nums?: boolean;
  nowrap?: boolean;
  className?: string;
  children?: React.ReactNode;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        'px-3 py-2.5 align-middle',
        tone === 'soft' && 'text-foreground/65',
        tone === 'muted' && 'text-foreground/45',
        tone === 'faint' && 'text-foreground/30',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        mono && 'font-mono text-xs',
        nums && 'tabular-nums',
        nowrap && 'whitespace-nowrap',
        className,
      )}
    >
      {children}
    </td>
  );
}

// ─── Filter tabs ─────────────────────────────────────────────────────────────

export function FilterTabs({
  tabs,
}: {
  tabs: { href: string; label: string; active: boolean }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 transition-colors',
            t.active
              ? 'bg-foreground/10 text-foreground'
              : 'text-foreground/45 hover:text-foreground hover:bg-foreground/5',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function SearchForm({
  name = 'q',
  defaultValue,
  placeholder,
  action,
}: {
  name?: string;
  defaultValue?: string;
  placeholder: string;
  action?: string;
}) {
  return (
    <form method="GET" action={action} className="flex gap-2">
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="flex-1 sm:flex-none sm:w-72 rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm transition-colors placeholder:text-foreground/35 focus:outline-none focus:ring-1 focus:ring-ring focus:border-foreground/20"
      />
      <button
        type="submit"
        className="rounded-md border border-foreground/10 bg-foreground/[0.06] px-4 py-2 text-sm transition-colors hover:bg-foreground/10 active:scale-[0.98]"
      >
        Найти
      </button>
    </form>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('px-4 py-12 text-center', className)}>
      <p className="text-sm text-foreground/55">{title}</p>
      {hint && <p className="mt-1 text-xs text-foreground/35">{hint}</p>}
    </div>
  );
}

// ─── Status badges (единые для обзора/таблиц) ────────────────────────────────

const ROLE_TONE: Record<string, BadgeTone> = {
  SUPERADMIN: 'error',
  ADMIN: 'accent',
  MODERATOR: 'warn',
  ARTIST: 'info',
  LISTENER: 'neutral',
};

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={ROLE_TONE[role] ?? 'neutral'}>{role}</Badge>;
}

const TRACK_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  READY: { tone: 'success', label: 'готов' },
  PROCESSING: { tone: 'warn', label: 'обработка' },
  BLOCKED: { tone: 'error', label: 'заблокирован' },
  FAILED: { tone: 'error', label: 'ошибка' },
};

export function TrackStatusBadge({ status }: { status: string }) {
  const s = TRACK_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

const RELEASE_STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  PUBLISHED: { tone: 'success', label: 'опубликован' },
  SCHEDULED: { tone: 'info', label: 'запланирован' },
  DRAFT: { tone: 'neutral', label: 'черновик' },
  ARCHIVED: { tone: 'neutral', label: 'архив' },
};

export function ReleaseStatusBadge({ status }: { status: string }) {
  const s = RELEASE_STATUS[status] ?? { tone: 'neutral' as BadgeTone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

// ─── Inline action link (таблицы: «Изм.» и пр.) ──────────────────────────────

export function ActionLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      className="inline-flex items-center rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 font-mono text-xs transition-colors hover:bg-foreground/10 hover:border-foreground/20 active:scale-[0.98] whitespace-nowrap"
    >
      {children}
    </Link>
  );
}
