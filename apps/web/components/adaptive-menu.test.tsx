// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const desktop = { value: true };
vi.mock('@/lib/is-desktop-pointer', () => ({ useIsDesktopPointer: () => desktop.value }));
vi.mock('@/store/player', () => ({ usePlayerStore: (sel: (s: unknown) => unknown) => sel({ track: null }) }));

import { AdaptiveMenu, type MenuItem } from './adaptive-menu';

function setup(items: MenuItem[]) {
  return render(
    <AdaptiveMenu
      open
      onOpenChange={() => {}}
      items={items}
      trigger={({ toggle, ref }) => (
        <button ref={ref} onClick={toggle}>триггер</button>
      )}
    />,
  );
}

afterEach(() => { cleanup(); vi.clearAllMocks(); desktop.value = true; });

describe('AdaptiveMenu', () => {
  it('на десктопе рендерит пункты в поповер-меню (role=menu)', () => {
    setup([{ label: 'Действие A', onClick: () => {} }]);
    expect(screen.getByRole('menu')).not.toBeNull();
    expect(screen.getByText('Действие A')).not.toBeNull();
  });

  it('клик по пункту вызывает его onClick', () => {
    const onClick = vi.fn();
    setup([{ label: 'Действие A', onClick }]);
    fireEvent.click(screen.getByText('Действие A'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('на таче рендерит пункты в bottom-sheet (портал в body, без role=menu)', () => {
    desktop.value = false;
    setup([{ label: 'Действие B', onClick: () => {} }]);
    const node = screen.getByText('Действие B');
    expect(document.body.contains(node)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
