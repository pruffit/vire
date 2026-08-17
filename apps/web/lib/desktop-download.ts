import { STREAM } from '@/lib/s3';

export const WINDOWS_INSTALLER_KEY = 'downloads/desktop/windows/VireMusic-Setup-x64.exe';

// Тот же паттерн, что S3ObjectStorage.upload(): `${publicBaseUrl}/${bucket}/${key}`.
// Ключ без версии — CI перезаписывает его при каждом теге (packages/storage/src/object-storage.ts).
export function getWindowsDownloadUrl(): string | null {
  const base = process.env.S3_PUBLIC_ENDPOINT;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${STREAM}/${WINDOWS_INSTALLER_KEY}`;
}

export const LINUX_INSTALLER_KEY = 'downloads/desktop/linux/VireMusic-x86_64.AppImage';

export function getLinuxDownloadUrl(): string | null {
  const base = process.env.S3_PUBLIC_ENDPOINT;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${STREAM}/${LINUX_INSTALLER_KEY}`;
}
