import { DrizzleBlockRepository } from '@vire/db';
import { BlockService } from '@vire/core';

export function blockService() {
  return new BlockService(new DrizzleBlockRepository());
}
