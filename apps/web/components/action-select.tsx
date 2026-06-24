'use client';

import { useTransition } from 'react';
import { Select } from '@/components/select';

/**
 * Инлайн-селект, меняющий значение через серверный экшен внутри `useTransition`:
 * на время запроса селект блокируется. Общая обвязка для смены статуса трека/
 * релиза и роли пользователя в админке — сам экшен передаётся через `onChange`.
 */
export function ActionSelect({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      size="sm"
      align="end"
      options={options}
      value={value}
      onValueChange={(v) => startTransition(() => onChange(v))}
      disabled={pending}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
