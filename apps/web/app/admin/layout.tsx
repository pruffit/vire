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
    <div className="h-full bg-background text-foreground flex flex-col md:flex-row">
      {/* Сайдбар на десктопе, горизонтальный топ-бар на мобилках */}
      <aside className="shrink-0 border-b border-white/10 md:border-b-0 md:border-r md:w-48 md:flex md:flex-col md:gap-1 md:px-3 md:py-6">
        <p className="hidden md:block text-xs text-white/25 font-mono px-3 mb-4 tracking-widest">
          Backoffice
        </p>
        <AdminNav />
        <div className="hidden md:block mt-auto pt-4 border-t border-white/10">
          <p className="px-3 text-xs text-white/20 truncate">{session.user.email}</p>
          <p className="px-3 text-xs text-white/30 font-mono">{session.user.role}</p>
        </div>
      </aside>

      {/* Content */}
      <main data-scroll-area className="flex-1 min-w-0 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
