import { DrizzleFriendshipRepository, DrizzleUserDirectoryRepository, DrizzleNotificationRepository, DrizzleBlockRepository } from '@vire/db';
import { FriendshipService, UserDirectoryService } from '@vire/core';

export function friendshipService() {
  return new FriendshipService(
    new DrizzleFriendshipRepository(),
    new DrizzleNotificationRepository(),
    new DrizzleBlockRepository(),
  );
}

export function userDirectoryService() {
  return new UserDirectoryService(new DrizzleUserDirectoryRepository());
}
