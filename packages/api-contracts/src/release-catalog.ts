import { z } from 'zod';
import { releaseCardSchema } from './catalog';

export const releaseCatalogQuerySchema = z.object({
  sort: z.enum(['fresh', 'popular']).optional(),
  sinceDays: z.coerce.number().int().min(1).max(365).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional(),
});
export type ReleaseCatalogQueryInput = z.infer<typeof releaseCatalogQuerySchema>;

export const releaseCatalogResponseSchema = z.object({
  items: z.array(releaseCardSchema),
  hasMore: z.boolean(),
});
export type ReleaseCatalogResponse = z.infer<typeof releaseCatalogResponseSchema>;
