import { DrizzleChatRepository, DrizzleFriendshipRepository, DrizzleBlockRepository } from '@vire/db';
import { ChatService } from '@vire/core';
import { realtimePublisher } from './realtime';
import { externalNotifyQueue } from './queue';

export function chatService() {
  return new ChatService(
    new DrizzleChatRepository(),
    new DrizzleFriendshipRepository(),
    new DrizzleBlockRepository(),
    realtimePublisher,
    externalNotifyQueue,
    Date.now,
  );
}
