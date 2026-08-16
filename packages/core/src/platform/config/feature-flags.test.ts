import { describe, it, expect, vi } from 'vitest';
import {
  FeatureFlagService,
  FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  isKnownFeatureFlag,
  type IFeatureFlagRepository,
  type FeatureFlagRow,
} from './feature-flags';

const KNOWN_KEY = 'sdui.home';

function makeRepo(rows: FeatureFlagRow[] = []): IFeatureFlagRepository {
  return {
    list: vi.fn().mockResolvedValue(rows),
    get: vi.fn().mockImplementation(async (key: string) => rows.find((r) => r.key === key) ?? null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

function row(key: string, enabled: boolean): FeatureFlagRow {
  return { key, enabled, updatedAt: new Date('2026-08-16T00:00:00Z'), updatedBy: 'admin-1' };
}

describe('реестр флагов', () => {
  it('ключ в реестре совпадает с ключом определения', () => {
    for (const [key, def] of Object.entries(FEATURE_FLAGS)) expect(def.key).toBe(key);
  });

  it('известные ключи распознаются, чужие — нет', () => {
    expect(isKnownFeatureFlag(KNOWN_KEY)).toBe(true);
    expect(isKnownFeatureFlag('nope')).toBe(false);
    expect(isKnownFeatureFlag('constructor')).toBe(false);
  });

  it('FEATURE_FLAG_KEYS покрывает реестр', () => {
    expect([...FEATURE_FLAG_KEYS].sort()).toEqual(Object.keys(FEATURE_FLAGS).sort());
  });
});

describe('FeatureFlagService.isEnabled', () => {
  it('без строки в БД действует default из реестра', async () => {
    const service = new FeatureFlagService(makeRepo());
    expect(await service.isEnabled(KNOWN_KEY)).toBe(FEATURE_FLAGS[KNOWN_KEY].defaultEnabled);
  });

  it('строка в БД перебивает default', async () => {
    const service = new FeatureFlagService(makeRepo([row(KNOWN_KEY, true)]));
    expect(await service.isEnabled(KNOWN_KEY)).toBe(true);
  });

  it('второй вызов берётся из кэша, репозиторий не дёргается повторно', async () => {
    const repo = makeRepo([row(KNOWN_KEY, true)]);
    const service = new FeatureFlagService(repo);
    await service.isEnabled(KNOWN_KEY);
    await service.isEnabled(KNOWN_KEY);
    expect(repo.get).toHaveBeenCalledTimes(1);
  });

  it('неизвестный ключ — ошибка, а не «выключено»', async () => {
    const service = new FeatureFlagService(makeRepo());
    await expect(service.isEnabled('nope')).rejects.toThrow(/Unknown feature flag/);
  });
});

describe('FeatureFlagService.setEnabled', () => {
  it('пишет в репозиторий и сбрасывает кэш', async () => {
    const rows = [row(KNOWN_KEY, false)];
    const repo = makeRepo(rows);
    const service = new FeatureFlagService(repo);

    expect(await service.isEnabled(KNOWN_KEY)).toBe(false);

    rows[0] = row(KNOWN_KEY, true);
    await service.setEnabled(KNOWN_KEY, true, 'admin-1');

    expect(repo.upsert).toHaveBeenCalledWith(KNOWN_KEY, true, 'admin-1');
    expect(await service.isEnabled(KNOWN_KEY)).toBe(true);
  });

  it('неизвестный ключ не пишется', async () => {
    const repo = makeRepo();
    const service = new FeatureFlagService(repo);
    await expect(service.setEnabled('nope', true, null)).rejects.toThrow(/Unknown feature flag/);
    expect(repo.upsert).not.toHaveBeenCalled();
  });
});

describe('FeatureFlagService.listWithState', () => {
  it('отдаёт весь реестр, помечая перекрытые в БД', async () => {
    const service = new FeatureFlagService(makeRepo([row(KNOWN_KEY, true)]));
    const state = await service.listWithState();

    expect(state).toHaveLength(FEATURE_FLAG_KEYS.length);
    const flag = state.find((s) => s.key === KNOWN_KEY);
    expect(flag).toMatchObject({ enabled: true, overridden: true, defaultEnabled: false });
    expect(flag?.updatedAt).toBeInstanceOf(Date);
  });

  it('без строк в БД — default и overridden=false', async () => {
    const service = new FeatureFlagService(makeRepo());
    const [flag] = await service.listWithState();
    expect(flag).toMatchObject({ enabled: false, overridden: false, updatedAt: null });
  });
});
