export interface ExternalDeliveryInput {
  notifyEmail: boolean;
  notifyPush: boolean;
  recipientOnline: boolean;
  emailDebounced: boolean;
  hasEmail: boolean;
  pushSubscriptionCount: number;
}

export interface ExternalDeliveryDecision {
  email: boolean;
  push: boolean;
}

export function decideExternalDelivery(i: ExternalDeliveryInput): ExternalDeliveryDecision {
  if (i.recipientOnline) return { email: false, push: false };
  return {
    email: i.notifyEmail && i.hasEmail && !i.emailDebounced,
    push: i.notifyPush && i.pushSubscriptionCount > 0,
  };
}
