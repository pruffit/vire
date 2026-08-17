import { describe, it, expect } from 'vitest';
import type { Screen } from '@vire/api-contracts';
import { endpointOf, findBlock } from '../sdui';

const blocks: Screen['blocks'] = [
  { id: 'featured', type: 'featured-release', props: {} },
  {
    id: 'fresh-releases',
    type: 'fresh-releases',
    props: { layout: 'row' },
    source: { kind: 'endpoint', endpoint: '/api/v1/home/fresh-releases' },
  },
  {
    id: 'hot-tracks',
    type: 'hot-tracks',
    props: { layout: 'list' },
    source: { kind: 'endpoint', endpoint: '/api/v1/home/hot-tracks' },
  },
  {
    id: 'flow',
    type: 'flow',
    props: {},
    source: { kind: 'inline', data: { chips: ['chill'] } },
  },
];

describe('findBlock', () => {
  it('находит блок заданного типа', () => {
    expect(findBlock(blocks, 'hot-tracks')?.id).toBe('hot-tracks');
  });

  it('блока нет в композиции — undefined', () => {
    expect(findBlock(blocks, 'artists')).toBeUndefined();
  });
});

describe('endpointOf', () => {
  it('возвращает endpoint блока с endpoint-источником', () => {
    expect(endpointOf(blocks, 'fresh-releases')).toBe('/api/v1/home/fresh-releases');
    expect(endpointOf(blocks, 'hot-tracks')).toBe('/api/v1/home/hot-tracks');
  });

  it('блок без source (featured-release) — null', () => {
    expect(endpointOf(blocks, 'featured-release')).toBeNull();
  });

  it('блок с inline-источником — null, не endpoint', () => {
    expect(endpointOf(blocks, 'flow')).toBeNull();
  });

  it('блока нет в композиции вообще — null', () => {
    expect(endpointOf(blocks, 'artists')).toBeNull();
  });
});
