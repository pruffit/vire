import { DrizzleFriendshipRepository } from '@vire/db';
import { FriendshipService } from '@vire/core';

export function friendshipService() {
  return new FriendshipService(new DrizzleFriendshipRepository());
}
