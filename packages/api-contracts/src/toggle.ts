import { z } from 'zod';

export const followResponseSchema = z.object({ following: z.boolean() });
export type FollowResponse = z.infer<typeof followResponseSchema>;

export const likeResponseSchema = z.object({ liked: z.boolean() });
export type LikeResponse = z.infer<typeof likeResponseSchema>;

export const presaveResponseSchema = z.object({
  presaved: z.boolean(),
  guest: z.boolean().optional(),
});
export type PresaveResponse = z.infer<typeof presaveResponseSchema>;
