import type { Actor, Permission } from './permissions';
import { ROLE_PERMISSIONS } from './permissions';

export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  // Роль приходит из JWT, выписанного до возможной правки enum — неизвестная роль не должна ронять гейт.
  return (ROLE_PERMISSIONS[actor.role] ?? []).includes(permission);
}
