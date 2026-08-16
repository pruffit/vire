import { z } from 'zod';

export const socialVisibilitySchema = z.enum(['FRIENDS', 'PRIVATE']);
export const localeSchema = z.enum(['ru', 'en']);

// Last.fm разрешает буквы, цифры, точку, дефис и подчёркивание — сюда же и ограничение длины.
export const LASTFM_USERNAME_RE = /^[a-zA-Z0-9_.-]{2,64}$/;

export const updateProfileRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    socialVisibility: socialVisibilitySchema.optional(),
    discoverable: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    lastfmUsername: z.string().regex(LASTFM_USERNAME_RE).max(64).nullable().optional(),
    locale: localeSchema.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nothing to update' });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/** Ответ отражает только применённые поля — клиент не должен считать неотправленное сброшенным. */
export const updateProfileResponseSchema = z.object({
  ok: z.literal(true),
  name: z.string().optional(),
  socialVisibility: socialVisibilitySchema.optional(),
  discoverable: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
  lastfmUsername: z.string().nullable().optional(),
  locale: localeSchema.optional(),
});
export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>;

export const avatarResponseSchema = z.object({
  ok: z.literal(true),
  image: z.string().nullable(),
});
export type AvatarResponse = z.infer<typeof avatarResponseSchema>;
