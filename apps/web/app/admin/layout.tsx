import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminNav } from './admin-nav';
import { RoleBadge } from '@/components/admin/ui';

const ADMIN_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
    redirect('/');
  }

  return (
    <div className="min-h-full bg-background text-foreground flex flex-col md:flex-row">
      <aside className="shrink-0 border-b border-foreground/10 md:border-b-0 md:border-r md:w-52 md:flex md:flex-col md:bg-foreground/[0.015] md:px-3 md:py-5">
        <div className="hidden md:flex items-center gap-2 px-3 mb-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35">
            Backoffice
          </span>
        </div>
        <AdminNav />
        <div className="hidden md:flex md:flex-col md:items-start md:gap-1.5 mt-auto pt-4 px-3 border-t border-foreground/10">
          <p className="max-w-full truncate text-xs text-foreground/40" title={session.user.email ?? undefined}>
            {session.user.email}
          </p>
          <RoleBadge role={session.user.role} />
        </div>
      </aside>

      <main data-scroll-area className="flex-1 min-w-0 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
