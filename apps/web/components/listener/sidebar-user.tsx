import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Ссылка на профиль в подвале сайдбара; раскладку подвала задаёт listener-sidebar. */
export function SidebarUser({
  name,
  avatarUrl,
  collapsed,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  collapsed: boolean;
  className?: string;
}) {
  const avatar = avatarUrl ? (
    <Image
      src={avatarUrl}
      alt=""
      width={36}
      height={36}
      className="h-9 w-9 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-sm font-medium text-foreground/70">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );

  if (collapsed) {
    return (
      <Link
        href="/profile"
        title={name}
        aria-label={`Профиль: ${name}`}
        className={cn('grid place-items-center rounded-md p-1 transition-colors hover:bg-foreground/5', className)}
      >
        {avatar}
      </Link>
    );
  }

  return (
    <Link
      href="/profile"
      className={cn('flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-foreground/5', className)}
    >
      {avatar}
      <span className="min-w-0">
        <span className="block truncate text-sm text-foreground/90">{name}</span>
        <span className="block truncate text-xs text-foreground/40">Профиль</span>
      </span>
    </Link>
  );
}
