import sodium from 'libsodium-wrappers';

let readyPromise: Promise<typeof sodium> | null = null;

export function sodiumReady(): Promise<typeof sodium> {
  if (!readyPromise) readyPromise = sodium.ready.then(() => sodium);
  return readyPromise;
}

export const toB64 = (u8: Uint8Array): string =>
  sodium.to_base64(u8, sodium.base64_variants.ORIGINAL);

export const fromB64 = (s: string): Uint8Array =>
  sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

export const utf8 = (s: string): Uint8Array => sodium.from_string(s);

export const fromUtf8 = (u8: Uint8Array): string => sodium.to_string(u8);
