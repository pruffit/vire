import type { Block, Screen } from '@vire/api-contracts';

/** Первый блок заданного типа в композиции экрана — сервер уже отфильтровал по `X-Vire-Blocks`. */
export function findBlock<T extends Block['type']>(
  blocks: Screen['blocks'],
  type: T,
): Extract<Block, { type: T }> | undefined {
  return blocks.find((block): block is Extract<Block, { type: T }> => block.type === type);
}

/**
 * URL эндпоинта для блока заданного типа, если он есть в композиции и у него есть
 * источник данных (`source.kind === 'endpoint'`). `inline`-источники и отсутствующие
 * блоки дают `null` — рендерер решает сам, как обходиться без данных (docs/sdui.md §2).
 */
export function endpointOf(blocks: Screen['blocks'], type: Block['type']): string | null {
  const block = findBlock(blocks, type);
  if (!block?.source || block.source.kind !== 'endpoint') return null;
  return block.source.endpoint;
}
