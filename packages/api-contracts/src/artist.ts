import { z } from 'zod';
import { artistProfileSchema } from './catalog';

export const artistDetailResponseSchema = artistProfileSchema;
export type ArtistDetailResponse = z.infer<typeof artistDetailResponseSchema>;
