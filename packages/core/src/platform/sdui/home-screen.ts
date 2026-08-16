export type SduiBlockType =
  | 'featured-release'
  | 'flow'
  | 'personal'
  | 'feed'
  | 'friends-activity'
  | 'hot-tracks'
  | 'fresh-releases'
  | 'upcoming'
  | 'listening-now'
  | 'playlists'
  | 'artists'
  | 'discovery'
  | 'catalog-empty-notice';

export interface SduiDataSource {
  kind: 'endpoint';
  endpoint: string;
  params?: Record<string, string | number>;
}

export interface SduiBlock {
  id: string;
  type: SduiBlockType;
  source?: SduiDataSource;
  props: Record<string, unknown>;
}

export interface SduiScreen {
  screen: string;
  version: number;
  revision: string;
  blocks: SduiBlock[];
}

export interface HomeScreenContext {
  isAuthenticated: boolean;
  /** Типы, которые клиент умеет рендерить; пустой список = ограничений нет (веб). */
  supportedBlocks?: readonly string[];
}

export const HOME_SCREEN_VERSION = 1;

// Порядок обязан совпадать со статической главной один в один: пока обе ветки живут
// рядом, расхождение здесь = расхождение экранов между включённым и выключенным флагом.
const HOME_BLOCKS: readonly (SduiBlock & { requiresAuth?: boolean })[] = [
  { id: 'featured', type: 'featured-release', props: {} },
  { id: 'flow', type: 'flow', props: {} },
  { id: 'personal', type: 'personal', props: {}, requiresAuth: true, source: { kind: 'endpoint', endpoint: '/api/v1/home/personal' } },
  { id: 'feed', type: 'feed', props: {}, requiresAuth: true, source: { kind: 'endpoint', endpoint: '/api/v1/feed' } },
  { id: 'friends-activity', type: 'friends-activity', props: {}, requiresAuth: true, source: { kind: 'endpoint', endpoint: '/api/v1/home/friends-activity' } },
  { id: 'hot-tracks', type: 'hot-tracks', props: { layout: 'list' }, source: { kind: 'endpoint', endpoint: '/api/v1/home/hot-tracks' } },
  { id: 'fresh-releases', type: 'fresh-releases', props: { layout: 'row' }, source: { kind: 'endpoint', endpoint: '/api/v1/home/fresh-releases' } },
  { id: 'upcoming', type: 'upcoming', props: {}, source: { kind: 'endpoint', endpoint: '/api/v1/home/upcoming' } },
  { id: 'listening-now', type: 'listening-now', props: {} },
  { id: 'playlists', type: 'playlists', props: { layout: 'row' }, source: { kind: 'endpoint', endpoint: '/api/v1/home/playlists' } },
  { id: 'artists', type: 'artists', props: { layout: 'row' }, source: { kind: 'endpoint', endpoint: '/api/v1/artists' } },
  { id: 'discovery', type: 'discovery', props: {}, requiresAuth: true },
  { id: 'catalog-empty-notice', type: 'catalog-empty-notice', props: {} },
];

/** Стабильный отпечаток композиции: меняется только вместе с составом и порядком блоков. */
export function screenRevision(blocks: SduiBlock[], version: number): string {
  const shape = `${version}:${blocks.map((b) => `${b.type}#${b.id}`).join(',')}`;
  let hash = 2166136261;
  for (let i = 0; i < shape.length; i++) {
    hash ^= shape.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function composeHomeScreen(ctx: HomeScreenContext): SduiScreen {
  const supported = ctx.supportedBlocks;
  const blocks = HOME_BLOCKS
    .filter((b) => (b.requiresAuth ? ctx.isAuthenticated : true))
    // Клиент не получает типов, которых не умеет рендерить (docs/sdui.md §5).
    .filter((b) => !supported || supported.length === 0 || supported.includes(b.type))
    .map(({ requiresAuth: _requiresAuth, ...block }) => ({ ...block, props: { ...block.props } }));

  return {
    screen: 'home',
    version: HOME_SCREEN_VERSION,
    revision: screenRevision(blocks, HOME_SCREEN_VERSION),
    blocks,
  };
}
