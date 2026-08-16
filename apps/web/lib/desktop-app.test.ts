// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { isDesktopApp } from './desktop-app';

describe('isDesktopApp', () => {
  afterEach(() => {
    delete (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__;
  });

  it('true, когда флаг выставлен в true', () => {
    window.__VIRE_DESKTOP__ = true;
    expect(isDesktopApp()).toBe(true);
  });

  it('false, когда флаг не установлен', () => {
    expect(isDesktopApp()).toBe(false);
  });

  it('false, когда флаг явно false', () => {
    window.__VIRE_DESKTOP__ = false;
    expect(isDesktopApp()).toBe(false);
  });
});
