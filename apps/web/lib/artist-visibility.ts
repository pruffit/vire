import { can, type PlatformRole } from '@vire/core/access';

export function canViewEmptyArtist(opts: { isMember: boolean; role: string | null | undefined }): boolean {
  if (opts.isMember) return true;
  return can(opts.role != null ? { id: '', role: opts.role as PlatformRole } : null, 'staff.content.preview');
}
