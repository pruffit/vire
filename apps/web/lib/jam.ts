import { db, DrizzleJamRepository, DrizzleWaveRepository } from '@vire/db';
import { JamService, WaveService, type IJamBroadcaster } from '@vire/core';
import { RedisJamStateStore } from './jam/jam-state';
import { WaveSessionStore } from './wave-session-store';
import { publishChannel, jamChannel } from './realtime';

const broadcaster: IJamBroadcaster = {
  broadcast: (jamId, event) => publishChannel(jamChannel(jamId), event),
};

export function jamService() {
  return new JamService(
    new DrizzleJamRepository(db),
    new RedisJamStateStore(),
    broadcaster,
    Date.now,
    Math.random,
    new WaveService(new DrizzleWaveRepository(db), new WaveSessionStore()),
  );
}
