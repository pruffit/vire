import { db, DrizzleJamRepository } from '@vire/db';
import { JamService, type IJamBroadcaster } from '@vire/core';
import { RedisJamStateStore } from './jam/jam-state';
import { publishChannel, jamChannel } from './realtime';

const broadcaster: IJamBroadcaster = {
  broadcast: (jamId, event) => publishChannel(jamChannel(jamId), event),
};

export function jamService() {
  return new JamService(new DrizzleJamRepository(db), new RedisJamStateStore(), broadcaster, Date.now, Math.random);
}
