import { cn } from '@vire/ui';

const LEVELS = [
  { label: 'слабый', color: 'bg-red-500' },
  { label: 'слабый', color: 'bg-red-500' },
  { label: 'средний', color: 'bg-yellow-500' },
  { label: 'хороший', color: 'bg-green-500' },
  { label: 'надёжный', color: 'bg-green-500' },
  { label: 'надёжный', color: 'bg-green-500' },
] as const;

function score(password: string): number {
  let s = 0;
  if (password.length >= 8) s++;
  if (password.length >= 12) s++;
  if (/[A-Z]/.test(password) || /[а-яА-Я]/.test(password)) s++;
  if (/[0-9]/.test(password)) s++;
  if (/[^A-Za-z0-9а-яА-Я]/.test(password)) s++;
  return s;
}

/**
 * Индикатор надёжности пароля — единый для формы регистрации и «Способов входа».
 * Чистая функция пропсов (без хуков). `size`: md (форма) / sm (компактный, в строке).
 */
export function PasswordStrength({ password, size = 'md' }: { password: string; size?: 'md' | 'sm' }) {
  const { label, color } = LEVELS[Math.min(score(password), 5)];
  const pct = Math.max(20, (Math.min(score(password), 5) / 5) * 100);

  return (
    <div className={cn(size === 'sm' ? 'mt-1 space-y-0.5' : 'mt-1.5 space-y-1')}>
      <div className={cn('w-full overflow-hidden rounded-full bg-muted', size === 'sm' ? 'h-0.5' : 'h-1')}>
        <div className={cn('h-full rounded-full transition-all duration-300', color)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
