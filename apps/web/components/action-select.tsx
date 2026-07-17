'use client';

import { useTransition } from 'react';
import { Select } from '@/components/select';

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
