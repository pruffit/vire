// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('во время поиска видно, что именно ищут, а не «Из любимых»', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(
      <PartyAddPanel
        {...noop}
        suggestions={[{ id: 't1', title: 'Любимое', artistName: 'Кто-то', coverUrl: null } as never]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Название трека или ссылка'), { target: { value: 'мотылёк' } });

    await waitFor(() => expect(screen.getByText(/Ищем «мотылёк»/)).toBeTruthy());
    expect(screen.queryByText('Из любимых')).toBeNull();
  });

  it('крестик очищает ввод и возвращает подсказки', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(suggestResponse([])));

    render(<PartyAddPanel {...noop} />);
    const input = screen.getByLabelText('Название трека или ссылка') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'что-то' } });
    expect(input.value).toBe('что-то');

    fireEvent.click(screen.getByLabelText('Очистить'));

    expect(input.value).toBe('');
    await waitFor(() => expect(screen.getByText(/Начните вводить/)).toBeTruthy());
  });

  it('упавший запрос деградирует молча — без блока и без падения', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    render(<PartyAddPanel {...noop} />);

    await waitFor(() => expect(screen.getByText(/Начните вводить/)).toBeTruthy());
    expect(screen.queryByText('Из вашего вкуса')).toBeNull();
  });
});
