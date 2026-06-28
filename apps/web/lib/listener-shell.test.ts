import { describe, it, expect } from 'vitest';
import { isListenerShellPath } from './listener-shell';

describe('isListenerShellPath', () => {
  it('listener-роуты → true', () => {
    for (const p of ['/', '/library', '/profile', '/artists', '/artists/foo', '/releases', '/search'])
      expect(isListenerShellPath(p)).toBe(true);
  });
  it('дашборд/админка/auth/секрет → false', () => {
    for (const p of ['/dashboard', '/dashboard/posts', '/admin', '/admin/users', '/sign-in', '/fwqa688'])
      expect(isListenerShellPath(p)).toBe(false);
  });
  it('не путает префиксы (/administrate ≠ /admin)', () => {
    expect(isListenerShellPath('/administrate')).toBe(true);
  });
});
