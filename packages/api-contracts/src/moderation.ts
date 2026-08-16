import { z } from 'zod';
import { uuidSchema } from './common';

export const reportTargetTypeSchema = z.enum(['USER', 'MESSAGE']);

export const createReportRequestSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: uuidSchema,
  reason: z.string().min(1).max(500),
});
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;

export const createReportResponseSchema = z.object({ id: z.string() });
export type CreateReportResponse = z.infer<typeof createReportResponseSchema>;

export const feedbackTypeSchema = z.enum(['bug', 'idea', 'artist', 'other']);

export const feedbackRequestSchema = z.object({
  type: feedbackTypeSchema,
  message: z.string().min(10).max(2000),
  page: z.string().max(200).optional(),
  // пустая строка допустима: поле необязательное, форма шлёт его всегда
  email: z.string().email().optional().or(z.literal('')),
});
export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;
