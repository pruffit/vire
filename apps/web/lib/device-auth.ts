import { randomBytes } from 'node:crypto';
import { DrizzleDeviceRepository, getUserRoleById } from '@vire/db';
import { DeviceAuthService } from '@vire/core/identity/device-auth';
import { getSigningSecret } from '@/lib/app-secret';

export function deviceAuthService(): DeviceAuthService {
  const secret = getSigningSecret();
  if (!secret) throw new Error('Signing secret is not configured');

  return new DeviceAuthService({
    repo: new DrizzleDeviceRepository(),
    secret,
    randomBytes: (size) => randomBytes(size),
    now: () => Date.now(),
    resolveRole: (userId) => getUserRoleById(userId),
  });
}
