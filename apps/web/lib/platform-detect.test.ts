import { describe, it, expect } from 'vitest';
import { detectPlatform } from './platform-detect';

const UA = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  macos: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  ipadOsDesktopUa: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
};

describe('detectPlatform', () => {
  it('распознаёт Windows', () => {
    expect(detectPlatform(UA.windows)).toBe('windows');
  });

  it('распознаёт macOS', () => {
    expect(detectPlatform(UA.macos)).toBe('macos');
  });

  it('распознаёт Linux', () => {
    expect(detectPlatform(UA.linux)).toBe('linux');
  });

  it('распознаёт Android раньше Linux (UA Android содержит "Linux")', () => {
    expect(detectPlatform(UA.android)).toBe('android');
  });

  it('распознаёт iPhone', () => {
    expect(detectPlatform(UA.iphone)).toBe('ios');
  });

  it('распознаёт iPad по UA', () => {
    expect(detectPlatform(UA.ipad)).toBe('ios');
  });

  it('распознаёт iPadOS 13+ по multi-touch поверх Mac-UA', () => {
    expect(detectPlatform(UA.ipadOsDesktopUa, 5)).toBe('ios');
  });

  it('не путает настоящий Mac (без multi-touch) с iPad', () => {
    expect(detectPlatform(UA.ipadOsDesktopUa, 0)).toBe('macos');
  });

  it('неизвестная UA — unknown', () => {
    expect(detectPlatform('curl/8.0')).toBe('unknown');
  });
});
