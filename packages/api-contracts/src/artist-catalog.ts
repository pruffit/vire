import { z } from 'zod';
import { artistCardSchema } from './catalog';

export const artistCatalogQuerySchema = z.object({
  query: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
});
export type ArtistCatalogQueryInput = z.infer<typeof artistCatalogQuerySchema>;

export const artistCatalogResponseSchema = z.object({
  items: z.array(artistCardSchema),
  hasMore: z.boolean(),
});
export type ArtistCatalogResponse = z.infer<typeof artistCatalogResponseSchema>;
