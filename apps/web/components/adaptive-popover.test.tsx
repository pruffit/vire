// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const desktop = { value: true };
vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => desktop.value }));
vi.mock('@/store/player', () => ({ usePlayerStore: (sel: (s: unknown) => unknown) => sel({ track: null }) }));

import { AdaptivePopover } from './adaptive-popover';

function setup() {
  return render(
    <AdaptivePopover
      open
      onOpenChange={() => {}}
      trigger={({ toggle, ref }) => (
        <button ref={ref} onClick={toggle}>триггер</button>
      )}
    >
      <p>содержимое поповера</p>
    </AdaptivePopover>,
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); desktop.value = true; });

describe('AdaptivePopover', () => {
  it('на десктопе рендерит children в поповере', () => {
    setup();
    expect(screen.getByText('содержимое поповера')).not.toBeNull();
  });

  it('на таче рендерит children в bottom-sheet (портал в body)', () => {
    desktop.value = false;
    setup();
    const node = screen.getByText('содержимое поповера');
    expect(document.body.contains(node)).toBe(true);
  });
});
