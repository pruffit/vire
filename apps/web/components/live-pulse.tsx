import { cn } from '@vire/ui';

/**
 * Точка «живого» индикатора. Пульс — box-shadow-keyframes вместо animate-ping:
 * ping (бесконечная transform-анимация) промоутит элемент в композит-слой,
 * который дрожит при скролле; box-shadow не компоузится, перерисовка крошечная.
 * Цвет — currentColor (задаётся className, напр. `text-green-400`).
 */
export function LivePulse({ small = false, className }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(small ? 'w-1.5 h-1.5' : 'w-2 h-2', 'shrink-0 rounded-full bg-current animate-live-pulse', className)}
    />
  );
}
