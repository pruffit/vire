// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { JamCodeForm } from './jam-code-form';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('JamCodeForm', () => {
  it('disables submit until a valid 6-char code is entered', () => {
    render(<JamCodeForm />);
    expect((screen.getByRole('button', { name: 'Войти по коду' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Код джема'), { target: { value: 'a2b3c' } });
    expect((screen.getByRole('button', { name: 'Войти по коду' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('uppercases input as it is typed', () => {
    render(<JamCodeForm />);
    fireEvent.change(screen.getByLabelText('Код джема'), { target: { value: 'a2b3c4' } });
    expect((screen.getByLabelText('Код джема') as HTMLInputElement).value).toBe('A2B3C4');
  });

  it('navigates to the jam room on submit with a valid code', () => {
    render(<JamCodeForm />);
    fireEvent.change(screen.getByLabelText('Код джема'), { target: { value: 'a2b3c4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти по коду' }));

    expect(push).toHaveBeenCalledWith('/jam/A2B3C4');
  });

  it('does not navigate when the code fails the checksum alphabet', () => {
    render(<JamCodeForm />);
    fireEvent.change(screen.getByLabelText('Код джема'), { target: { value: 'AAAAA1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Войти по коду' }));

    expect(push).not.toHaveBeenCalled();
  });
});
