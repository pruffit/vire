import { z } from 'zod';
import { releaseSchema } from './catalog';
import { trackSchema } from './release-page';

export const releaseDetailResponseSchema = z.object({
  release: releaseSchema,
  tracks: z.array(trackSchema),
});
export type ReleaseDetailResponse = z.infer<typeof releaseDetailResponseSchema>;
