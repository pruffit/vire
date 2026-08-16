import { createTtlCache } from '../util/ttl-cache';

export interface FeatureFlagDef {
  key: string;
  defaultEnabled: boolean;
  description: string;
}

// Реестр — источник правды о существующих флагах: строки в БД может не быть,
// флаг всё равно есть и действует по defaultEnabled.
export const FEATURE_FLAGS: Readonly<Record<string, FeatureFlagDef>> = {
  'sdui.home': {
    key: 'sdui.home',
    defaultEnabled: false,
    description: 'Главная собирается из блоков по SDUI-протоколу вместо статической композиции',
  },
};

export const FEATURE_FLAG_KEYS: readonly string[] = Object.keys(FEATURE_FLAGS);

export function isKnownFeatureFlag(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key);
}

export interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface IFeatureFlagRepository {
  list(): Promise<FeatureFlagRow[]>;
  get(key: string): Promise<FeatureFlagRow | null>;
  upsert(key: string, enabled: boolean, actorId: string | null): Promise<void>;
}

export interface FeatureFlagState {
  key: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
  overridden: boolean;
  updatedAt: Date | null;
}

export const FEATURE_FLAG_CACHE_TTL_MS = 30_000;

export class FeatureFlagService {
  private readonly cache;

  constructor(
    private readonly repo: IFeatureFlagRepository,
    ttlMs: number = FEATURE_FLAG_CACHE_TTL_MS,
  ) {
    this.cache = createTtlCache<string, boolean>({ ttlMs, maxSize: 100 });
  }

  private assertKnown(key: string): FeatureFlagDef {
    const def = FEATURE_FLAGS[key];
    if (!def) throw new Error(`Unknown feature flag: ${key}`);
    return def;
  }

  async isEnabled(key: string): Promise<boolean> {
    const def = this.assertKnown(key);
    return this.cache.get(key, async () => {
      const row = await this.repo.get(key);
      return row?.enabled ?? def.defaultEnabled;
    });
  }

  /** Состояние всех флагов реестра — мимо кэша: админке нужно актуальное, а не TTL-давности. */
  async listWithState(): Promise<FeatureFlagState[]> {
    const rows = await this.repo.list();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return FEATURE_FLAG_KEYS.map((key) => {
      const def = FEATURE_FLAGS[key];
      const row = byKey.get(key);
      return {
        key,
        description: def.description,
        enabled: row?.enabled ?? def.defaultEnabled,
        defaultEnabled: def.defaultEnabled,
        overridden: row !== undefined,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async setEnabled(key: string, enabled: boolean, actorId: string | null): Promise<void> {
    this.assertKnown(key);
    await this.repo.upsert(key, enabled, actorId);
    this.cache.clear();
  }
}
