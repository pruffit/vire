// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { toast } from '@/lib/toast';
import { CreateJamButton } from './create-jam-button';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CreateJamButton', () => {
  it('does not call the API before a click', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<CreateJamButton />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a jam and navigates to its room on click', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 'A2B3C4' }) } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<CreateJamButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Создать джем' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/jam/A2B3C4'));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/jam', { method: 'POST' });
  });

  it('shows a toast and re-enables the button on failure', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<CreateJamButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Создать джем' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Не удалось создать джем'));
    expect(push).not.toHaveBeenCalled();
  });
});
