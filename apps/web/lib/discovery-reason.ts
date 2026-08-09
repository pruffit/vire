import type { DiscoveryReason } from '@vire/core';

/** t — переводчик namespace 'common' (ключи discoveryReason.*). */
export function discoveryReasonLabel(reason: DiscoveryReason, t: (key: string) => string): string {
  return t(`discoveryReason.${reason}`);
}
