import { cn } from '@vire/ui';

/**
 * Live-точка. Пульс — box-shadow-keyframes, не animate-ping: ping промоутит
 * композит-слой, который дрожит при скролле. Цвет — currentColor через className.
 */
export function LivePulse({ small = false, className }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(small ? 'w-1.5 h-1.5' : 'w-2 h-2', 'shrink-0 rounded-full bg-current animate-live-pulse', className)}
    />
  );
}
