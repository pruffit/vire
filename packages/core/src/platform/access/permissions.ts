export type PlatformRole = 'LISTENER' | 'ARTIST' | 'VIEWER' | 'MODERATOR' | 'ADMIN' | 'SUPERADMIN';

export type Permission =
  | 'admin.panel.view'
  | 'admin.read'
  | 'admin.content.moderate'
  | 'admin.users.manage'
  | 'admin.jobs.run'
  | 'admin.flags.manage'
  | 'staff.content.preview';

export interface Actor {
  id: string;
  role: PlatformRole;
}

const ADMIN_ALL: readonly Permission[] = [
  'admin.panel.view',
  'admin.read',
  'admin.content.moderate',
  'admin.users.manage',
  'admin.jobs.run',
  'admin.flags.manage',
  'staff.content.preview',
];

export const ROLE_PERMISSIONS: Record<PlatformRole, readonly Permission[]> = {
  LISTENER: [],
  // Артист-периметр — ownership (activeArtist), не роль; см. authorizeTrackOwnership.
  ARTIST: [],
  VIEWER: ['admin.panel.view', 'admin.read'],
  MODERATOR: ['admin.panel.view', 'admin.read', 'admin.content.moderate', 'staff.content.preview'],
  ADMIN: ADMIN_ALL,
  SUPERADMIN: ADMIN_ALL,
};
