import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminNav } from './admin-nav';

const ADMIN_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
    redirect('/');
  }

  return (
    <div className="h-full bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r border-white/10 flex flex-col gap-1 px-3 py-6">
        <p className="text-xs text-white/25 font-mono px-3 mb-4 tracking-widest">
          Backoffice
        </p>
        <AdminNav />
        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="px-3 text-xs text-white/20 truncate">{session.user.email}</p>
          <p className="px-3 text-xs text-white/30 font-mono">{session.user.role}</p>
        </div>
      </aside>

      {/* Content */}
      <main data-scroll-area className="flex-1 min-w-0 overflow-y-auto px-8 py-8">
        {children}
      </main>
    </div>
  );
}
