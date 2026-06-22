import Link from 'next/link';
import * as React from 'react';
import { cn } from '@vire/ui';

/**
 * UI kit — единый словарь продуктовых поверхностей (админка + дашборд артиста).
 *
 * Принципы (Impeccable / product-регистр):
 * - Нейтраль через `foreground`-альфу, НЕ `white/X` — сохраняет тёплую подкраску
 *   платформы (hue 75). Один масштаб прозрачностей на всё.
 * - Плотность и точность: mono для данных и меток, tabular-nums для чисел.
 * - У каждого интерактива есть hover/focus/active; статусы — бейджи, не цветной текст.
 *
 * Всё презентационное и server-совместимое (без хуков/обработчиков), кроме
 * client-only `Check` (управляемый чекбокс) — он помечен 'use client' неявно через
 * использование в client-компонентах; сам по себе хуков не держит.
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

/** Класс текстового поля/textarea/select в формах. Ширину задаёт вызов. */
export const fieldClass =
  'rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-sm transition-colors placeholder:text-foreground/35 focus:outline-none focus:ring-1 focus:ring-ring focus:border-foreground/20';

/** Главная кнопка действия (submit/создать). */
export const btnPrimary =
  'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition-[background-color,opacity] hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40';

/** Вторичная/призрачная кнопка или ссылка-кнопка в обводке. */
export const btnGhost =
  'inline-flex items-center justify-center rounded-md border border-foreground/10 bg-foreground/[0.04] px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground active:scale-[0.98] disabled:opacity-40';

// ─── Form field ──────────────────────────────────────────────────────────────

/**
 * Подпись + контрол. Единая метка (mono, uppercase) для всех форм продукта.
 * `hint` — необязательная вспомогательная подпись справа от метки.
 */
export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      <span className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/45">
          {label}
        </span>
        {hint && <span className="text-xs text-foreground/30 normal-case tracking-normal font-sans">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

// ─── Checkbox ──────────────────────────────────────────────────────────────

/**
 * Кастомный чекбокс с подписью и хинтом (как в редакторе трека админки).
 * Контролируемый — `checked` + `onChange(next)`. Тач-таргет — вся подпись.
 */
export function Check({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none py-1">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-4 appearance-none rounded border border-foreground/30 bg-foreground/5 transition-colors checked:bg-primary checked:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer disabled:opacity-50"
        />
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm leading-tight text-foreground/85">{label}</span>
        {hint && <span className="text-[11px] leading-tight text-foreground/40">{hint}</span>}
      </span>
    </label>
  );
}

// ─── Switch ──────────────────────────────────────────────────────────────────

/**
 * Единый тумблер платформы (вкл/выкл). Контролируемый: `checked` + `onChange`.
 * Для подписи оборачивай в `Field`/`label` снаружи.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-foreground/15',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

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

// ─── Dashboard page header (сабстраницы дашборда артиста) ────────────────────

/**
 * Единый хедер сабстраниц дашборда: заголовок (+подзаголовок) слева, кнопка
 * «← назад» справа в одну строку — как на главной дашборда и в «Релизах». Опц.
 * `action` встаёт слева от кнопки «назад».
 */
export function DashboardPageHeader({
  backHref,
  backLabel = 'Дашборд',
  title,
  subtitle,
  action,
}: {
  backHref: string;
  backLabel?: string;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-foreground/40">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <Link href={backHref} className={btnGhost}>
          ← {backLabel}
        </Link>
      </div>
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
  pulse = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  /** Пульсация точки — для «идёт процесс» (PROCESSING). */
  pulse?: boolean;
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
      {dot && (
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', BADGE_DOT[tone], pulse && 'animate-pulse')} />
      )}
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
    <Badge tone={s.tone} dot pulse={status === 'PROCESSING'}>
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
