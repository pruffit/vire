import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';

const ADMIN_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

const NAV = [
  { href: '/admin', label: 'Обзор' },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/tracks', label: 'Треки' },
  { href: '/admin/releases', label: 'Релизы' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
    redirect('/');
  }

  return (
    <div className="h-full bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r border-white/10 flex flex-col gap-1 px-3 py-6">
        <p className="text-xs font-mono text-white/30 uppercase tracking-widest px-3 mb-4">
          Backoffice
        </p>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-md text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            {item.label}
          </Link>
        ))}
        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="px-3 text-xs text-white/20 truncate">{session.user.email}</p>
          <p className="px-3 text-xs text-white/30 font-mono">{session.user.role}</p>
        </div>
      </aside>

      {/* Content — единственная скролл-область админки; сайдбар остаётся на месте */}
      <main data-scroll-area className="flex-1 min-w-0 overflow-y-auto px-8 py-8">
        {children}
      </main>
    </div>
  );
}
