import { DrizzleFeatureFlagRepository } from '@vire/db';
import { FeatureFlagService } from '@vire/core';

// Один инстанс на процесс — TTL-кэш внутри сервиса имеет смысл только при переиспользовании.
const globalForFlags = globalThis as unknown as { _featureFlags?: FeatureFlagService };

export function featureFlagService(): FeatureFlagService {
  globalForFlags._featureFlags ??= new FeatureFlagService(new DrizzleFeatureFlagRepository());
  return globalForFlags._featureFlags;
}

export function isFeatureEnabled(key: string): Promise<boolean> {
  return featureFlagService().isEnabled(key);
}
