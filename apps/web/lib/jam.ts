import { db, DrizzleJamRepository } from '@vire/db';
import { JamService, type IJamBroadcaster } from '@vire/core';
import { RedisJamStateStore } from './jam/jam-state';

// TODO(2.1): подменить на реальный broadcaster поверх lib/realtime.ts.
const noopBroadcaster: IJamBroadcaster = { async broadcast() {} };

export function jamService() {
  return new JamService(new DrizzleJamRepository(db), new RedisJamStateStore(), noopBroadcaster, Date.now, Math.random);
}
