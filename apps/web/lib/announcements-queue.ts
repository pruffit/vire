export function nextAutoAnnouncement<T extends { storageKey: string }>(
  list: readonly T[],
  isSeen: (key: string) => boolean,
): T | null {
  return list.find((a) => !isSeen(a.storageKey)) ?? null;
}
