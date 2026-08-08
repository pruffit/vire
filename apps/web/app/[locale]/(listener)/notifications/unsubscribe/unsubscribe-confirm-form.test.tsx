// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UnsubscribeConfirmForm } from './unsubscribe-confirm-form';

afterEach(() => cleanup());

describe('UnsubscribeConfirmForm', () => {
  it('рендерится без запроса до клика', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<UnsubscribeConfirmForm uid="user-1" token="tok" />);
    expect(screen.getByText('Отписаться от email-уведомлений?')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('клик шлёт POST на подписанный линк и показывает подтверждение', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<UnsubscribeConfirmForm uid="user-1" token="tok" />);
    fireEvent.click(screen.getByRole('button', { name: 'Отписаться' }));

    await waitFor(() => expect(screen.getByText('Вы отписаны')).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/notifications/unsubscribe?uid=user-1&token=tok',
      { method: 'POST' },
    );
  });

  it('ошибка сервера показывает сообщение и не мутирует локальный статус на "done"', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false } as Response));
    vi.stubGlobal('fetch', fetchMock);

    render(<UnsubscribeConfirmForm uid="user-1" token="tok" />);
    fireEvent.click(screen.getByRole('button', { name: 'Отписаться' }));

    await waitFor(() => expect(screen.getByText(/Не удалось отписаться/)).toBeTruthy());
    expect(screen.queryByText('Вы отписаны')).toBeNull();
  });
});
