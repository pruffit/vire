import { searchResponseSchema, type SearchResponse } from '@vire/api-contracts';
import type { ApiResult } from '@vire/api-client';
import { apiRequest } from './api-client';

// Сегменты пути экранируем — тот же принцип, что apps/mobile/lib/friends.ts.
const seg = encodeURIComponent;

// Публичный, рейт-лимитится по IP на сервере (apps/web/app/api/v1/search/route.ts) —
// та же ручка, что и веб-поиск, без отдельного мобильного эндпоинта.
export function search(query: string, limit?: number): Promise<ApiResult<SearchResponse>> {
  const limitParam = limit ? `&limit=${seg(String(limit))}` : '';
  return apiRequest(`/api/v1/search?q=${seg(query)}${limitParam}`, { schema: searchResponseSchema });
}
