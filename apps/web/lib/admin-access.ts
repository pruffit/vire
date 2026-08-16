import { auth } from '@/auth';
import { can } from '@vire/core/access';

export interface AdminAccess {
  canModerate: boolean;
  canManageUsers: boolean;
  canRunJobs: boolean;
  canManageFlags: boolean;
}

// Собирает флаги для условного рендера мутаций в админке (VIEWER читает всё, мутирует ничего).
export async function getAdminAccess(): Promise<AdminAccess> {
  const session = await auth();
  const actor = session?.user ?? null;
  return {
    canModerate: can(actor, 'admin.content.moderate'),
    canManageUsers: can(actor, 'admin.users.manage'),
    canRunJobs: can(actor, 'admin.jobs.run'),
    canManageFlags: can(actor, 'admin.flags.manage'),
  };
}
