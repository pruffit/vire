import { beforeAll, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers';
import { sodiumReady, toB64 } from './sodium';
import { newEphemeral, deriveLinkSecret, sasDigits6, wrapPriv, unwrapPriv, hashCommit, commitMatches } from './linking';

describe('e2ee/linking', () => {
  beforeAll(async () => {
    await sodiumReady();
  });

  it('both sides derive the same link secret and SAS', () => {
    const a = newEphemeral();
    const b = newEphemeral();
    const sA = deriveLinkSecret(a.priv, b.pub);
    const sB = deriveLinkSecret(b.priv, a.pub);
    expect(toB64(sA)).toBe(toB64(sB));

    const sasA = sasDigits6(b.pub, a.pub, sA);
    const sasB = sasDigits6(b.pub, a.pub, sB);
    expect(sasA).toBe(sasB);
    expect(sasA).toMatch(/^\d{6}$/);
  });

  it('a MITM ephemeral yields a different SAS (authentication)', () => {
    const a = newEphemeral();
    const b = newEphemeral();
    const m = newEphemeral();
    const honest = sasDigits6(b.pub, a.pub, deriveLinkSecret(a.priv, b.pub));
    const mitm = sasDigits6(b.pub, m.pub, deriveLinkSecret(m.priv, b.pub));
    expect(mitm).not.toBe(honest);
  });

  it('wraps and unwraps the identity private key over the link secret', () => {
    const a = newEphemeral();
    const b = newEphemeral();
    const s = deriveLinkSecret(a.priv, b.pub);
    const ikPriv = sodium.crypto_box_keypair().privateKey;

    const { wrapped, nonce } = wrapPriv(ikPriv, s);
    const recovered = unwrapPriv(wrapped, nonce, deriveLinkSecret(b.priv, a.pub));
    expect(recovered).not.toBeNull();
    expect(toB64(recovered!)).toBe(toB64(ikPriv));
  });

  it('binds a commitment to the ephemeral key', () => {
    const b = newEphemeral();
    const other = newEphemeral();
    const commit = hashCommit(b.pub);
    expect(commitMatches(b.pub, commit)).toBe(true);
    expect(commitMatches(other.pub, commit)).toBe(false);
  });

  it('returns null when the wrapped blob is corrupted', () => {
    const a = newEphemeral();
    const b = newEphemeral();
    const s = deriveLinkSecret(a.priv, b.pub);
    const { nonce } = wrapPriv(sodium.crypto_box_keypair().privateKey, s);
    expect(unwrapPriv(toB64(sodium.randombytes_buf(48)), nonce, s)).toBeNull();
  });
});
