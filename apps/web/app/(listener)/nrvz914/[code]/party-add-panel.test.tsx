// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { PartyAddPanel } from './party-add-panel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function suggestResponse(candidates: unknown[]): Response {
  return new Response(JSON.stringify({ candidates }), { status: 200 });
}

const noop = { onAddVire: vi.fn(), addExternal: vi.fn(), addedTrackIds: new Set<string>() };

describe('PartyAddPanel — предложка по вкусу (Last.fm)', () => {
  it('пустой ответ /party/suggest — блока «Из вашего вкуса» нет', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(suggestResponse([])));

    render(<PartyAddPanel {...noop} />);

    await waitFor(() => expect(screen.getByText(/Начните вводить/)).toBeTruthy());
    expect(screen.queryByText('Из вашего вкуса')).toBeNull();
  });

  it('непустой ответ — блок появляется с треками из вкуса', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        suggestResponse([{ kind: 'HINT', hint: { title: 'Song', artistName: 'Artist', coverUrl: null, durationSec: null } }]),
      ),
    );

    render(<PartyAddPanel {...noop} />);

    await waitFor(() => expect(screen.getByText('Из вашего вкуса')).toBeTruthy());
    expect(screen.getByText('Song')).toBeTruthy();
    expect(screen.getByText('Artist')).toBeTruthy();
  });

  it('упавший запрос деградирует молча — без блока и без падения', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    render(<PartyAddPanel {...noop} />);

    await waitFor(() => expect(screen.getByText(/Начните вводить/)).toBeTruthy());
    expect(screen.queryByText('Из вашего вкуса')).toBeNull();
  });
});
