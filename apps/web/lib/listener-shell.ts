const NON_LISTENER_PREFIXES = ['/dashboard', '/admin', '/sign-in', '/fwqa688'];

/** Нужны ли на этом пути слушательские сайдбар/таб-бар (true), или у роута своя оболочка (false). */
export function isListenerShellPath(pathname: string): boolean {
  return !NON_LISTENER_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
