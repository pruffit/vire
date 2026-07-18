import { DrizzleFriendshipRepository, DrizzleUserDirectoryRepository } from '@vire/db';
import { FriendshipService, UserDirectoryService } from '@vire/core';

export function friendshipService() {
  return new FriendshipService(new DrizzleFriendshipRepository());
}

export function userDirectoryService() {
  return new UserDirectoryService(new DrizzleUserDirectoryRepository());
}
