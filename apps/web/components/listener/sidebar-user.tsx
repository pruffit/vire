import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function SidebarUser({
  name,
  avatarUrl,
  collapsed,
}: {
  name: string;
  avatarUrl: string | null;
  collapsed: boolean;
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
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-foreground/10 text-sm font-medium">
      {name[0]?.toUpperCase() ?? '?'}
    </span>
  );

  return (
    <div className={cn('shrink-0 border-t border-border', collapsed ? 'px-2 py-2' : 'px-1.5 py-2')}>
      {collapsed ? (
        <Link
          href="/profile"
          title={name}
          aria-label={`Профиль: ${name}`}
          className="flex justify-center rounded-md p-1 hover:bg-foreground/5"
        >
          {avatar}
        </Link>
      ) : (
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-foreground/5"
        >
          {avatar}
          <span className="min-w-0">
            <span className="block truncate text-sm">{name}</span>
            <span className="block truncate text-xs text-foreground/40">Профиль</span>
          </span>
        </Link>
      )}
    </div>
  );
}
