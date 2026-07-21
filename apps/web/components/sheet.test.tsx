// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/store/player', () => ({ usePlayerStore: (sel: (s: unknown) => unknown) => sel({ track: null }) }));

import { Sheet } from './sheet';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Sheet', () => {
  it('не рендерит содержимое, когда закрыт', () => {
    render(<Sheet open={false} onClose={() => {}}><p>содержимое</p></Sheet>);
    expect(screen.queryByText('содержимое')).toBeNull();
  });

  it('рендерит содержимое порталом в body, когда открыт', () => {
    render(<Sheet open onClose={() => {}}><p>содержимое</p></Sheet>);
    const node = screen.getByText('содержимое');
    expect(node).not.toBeNull();
    expect(document.body.contains(node)).toBe(true);
  });

  it('вызывает onClose по Escape', () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose}><p>содержимое</p></Sheet>);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('anchor="bottom" даёт прилипшую к низу геометрию (rounded-t)', () => {
    render(<Sheet open onClose={() => {}} anchor="bottom"><p data-testid="c">c</p></Sheet>);
    const panel = screen.getByTestId('c').closest('.rounded-t-2xl');
    expect(panel).not.toBeNull();
  });
});
