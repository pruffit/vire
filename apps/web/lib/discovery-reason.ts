import type { DiscoveryReason } from '@vire/core';

export function discoveryReasonLabel(reason: DiscoveryReason): string {
  switch (reason) {
    case 'friends': return 'Слушают ваши друзья';
    case 'similar': return 'Похоже на то, что вы слушаете';
    case 'taste': return 'В вашем жанре';
  }
}
