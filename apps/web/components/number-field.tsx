'use client';

import { fieldClass, selectClass } from '@/components/ui-kit';
import { cn } from '@/lib/utils';

/**
 * Числовое поле со своими кнопками +/− (нативный спиннер мимо темы, скрыт).
 * `value: null` = пусто; `onChange` на каждый ввод, `onCommit` на blur/Enter/шаг.
 */

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Коммит (blur/Enter/шаг) — для отправки на сервер. */
  onCommit?: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

export function NumberField({
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  placeholder,
  disabled,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: Props) {
  const sm = size === 'sm';

  const clamp = (n: number) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };

  const bump = (dir: 1 | -1) => {
    const next = clamp((value ?? min ?? 0) + dir * step);
    onChange(next);
    onCommit?.(next);
  };

  const atMax = max != null && (value ?? min ?? 0) >= max;
  const atMin = min != null && (value ?? min ?? 0) <= min;

  return (
    <div className={cn('relative inline-flex w-full', className)}>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
        onBlur={() => {
          if (value == null) return onCommit?.(null);
          const c = clamp(value);
          if (c !== value) onChange(c);
          onCommit?.(c);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
        }}
        className={cn(
          sm ? selectClass : fieldClass,
          'w-full pr-7 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        )}
      />
      <div className="absolute right-1 inset-y-1 flex flex-col justify-center">
        <Stepper dir="up" disabled={disabled || atMax} onClick={() => bump(1)} />
        <Stepper dir="down" disabled={disabled || atMin} onClick={() => bump(-1)} />
      </div>
    </div>
  );
}

function Stepper({
  dir,
  disabled,
  onClick,
}: {
  dir: 'up' | 'down';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onClick={onClick}
      aria-label={dir === 'up' ? 'Увеличить' : 'Уменьшить'}
      className="flex h-3.5 w-5 items-center justify-center rounded text-foreground/40 transition-colors hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:pointer-events-none"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dir === 'up' ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
      </svg>
    </button>
  );
}
