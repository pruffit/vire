const PRIVILEGED_ROLES = new Set(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

export function canViewEmptyArtist(opts: { isMember: boolean; role: string | null | undefined }): boolean {
  return opts.isMember || (opts.role != null && PRIVILEGED_ROLES.has(opts.role));
}
