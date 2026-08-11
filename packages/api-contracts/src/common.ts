import { z } from 'zod';

export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const okResponseSchema = z.object({ ok: z.boolean() });
export type OkResponse = z.infer<typeof okResponseSchema>;

export const uuidSchema = z.string().uuid();
