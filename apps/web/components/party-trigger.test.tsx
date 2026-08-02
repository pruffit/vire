// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { PartyTrigger } from './party-trigger';
import { PARTY_PATH } from '@/lib/party';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PartyTrigger', () => {
  it('три клика подряд ведут на секретный вход', () => {
    render(<PartyTrigger>© VireMusic</PartyTrigger>);
    const el = screen.getByText('© VireMusic');

    fireEvent.click(el);
    fireEvent.click(el);
    fireEvent.click(el);

    expect(push).toHaveBeenCalledWith(PARTY_PATH);
  });

  it('два клика ничего не делают', () => {
    render(<PartyTrigger>© VireMusic</PartyTrigger>);
    const el = screen.getByText('© VireMusic');

    fireEvent.click(el);
    fireEvent.click(el);

    expect(push).not.toHaveBeenCalled();
  });

  it('клики за пределами окна 600мс не накапливаются', () => {
    vi.useFakeTimers();
    render(<PartyTrigger>© VireMusic</PartyTrigger>);
    const el = screen.getByText('© VireMusic');

    fireEvent.click(el);
    vi.advanceTimersByTime(700);
    fireEvent.click(el);
    fireEvent.click(el);

    expect(push).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('четвёртый клик после срабатывания не триггерит повторно с накопленным хвостом', () => {
    render(<PartyTrigger>© VireMusic</PartyTrigger>);
    const el = screen.getByText('© VireMusic');

    fireEvent.click(el);
    fireEvent.click(el);
    fireEvent.click(el);
    expect(push).toHaveBeenCalledTimes(1);

    fireEvent.click(el);
    expect(push).toHaveBeenCalledTimes(1);
  });
});
