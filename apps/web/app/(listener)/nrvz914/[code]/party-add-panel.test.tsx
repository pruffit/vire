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

  it('готовое к добавлению и «найдём в сети» разведены по секциям', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(suggestResponse([
      {
        kind: 'EXTERNAL',
        ref: { source: 'YOUTUBE', externalId: 'y1', externalUrl: 'https://youtu.be/y1', title: 'Титан', artistName: 'Кто-то', coverUrl: null, durationSec: 200 },
      },
      { kind: 'HINT', hint: { title: 'Титан (live)', artistName: 'Кто-то', coverUrl: null, durationSec: null } },
    ]))));

    render(<PartyAddPanel {...noop} />);
    fireEvent.change(screen.getByLabelText('Название трека или ссылка'), { target: { value: 'титан' } });

    await waitFor(() => expect(screen.getByText('Играет сразу')).toBeTruthy());
    expect(screen.getByText('Найдём в сети')).toBeTruthy();
  });

  it('стрелка вниз и Enter добавляют первый результат', async () => {
    const onAddVire = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(suggestResponse([
      { kind: 'VIRE', trackId: 't1', title: 'Титан', artistName: 'Кто-то', coverUrl: null },
    ]))));

    render(<PartyAddPanel {...noop} onAddVire={onAddVire} />);
    const input = screen.getByLabelText('Название трека или ссылка');
    fireEvent.change(input, { target: { value: 'титан' } });

    await waitFor(() => expect(screen.getByText('Титан')).toBeTruthy());
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAddVire).toHaveBeenCalledWith(expect.objectContaining({ trackId: 't1' }));
  });

  it('упавший запрос деградирует молча — без блока и без падения', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    render(<PartyAddPanel {...noop} />);

    await waitFor(() => expect(screen.getByText(/Начните вводить/)).toBeTruthy());
    expect(screen.queryByText('Из вашего вкуса')).toBeNull();
  });
});
