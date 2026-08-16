import { z } from 'zod';

export const DEVICE_PLATFORMS = ['ios', 'android', 'desktop', 'other'] as const;

export const registerDeviceRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  platform: z.enum(DEVICE_PLATFORMS),
});
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresInSec: z.number().int().positive(),
  deviceId: z.string(),
});
export type TokenPairResponse = z.infer<typeof tokenPairSchema>;

// Ни хэша refresh, ни срока его жизни наружу: клиенту они не нужны, а утечка их удешевляет атаку.
export const deviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: z.enum(DEVICE_PLATFORMS),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  current: z.boolean(),
});
export type DeviceDTO = z.infer<typeof deviceSchema>;

export const devicesResponseSchema = z.object({ devices: z.array(deviceSchema) });
export type DevicesResponse = z.infer<typeof devicesResponseSchema>;
