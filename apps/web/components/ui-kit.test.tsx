// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import { Table, Thead, Th, Tr, Td } from './ui-kit';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Table/Td label', () => {
  it('показывает подпись только на ячейках с label, не дублируя её на безлейбловых', () => {
    const { container } = render(
      <Table>
        <Thead>
          <Th>Email</Th>
        </Thead>
        <tbody>
          <Tr>
            <Td label="Email">a@b.c</Td>
            <Td>plain</Td>
          </Tr>
        </tbody>
      </Table>,
    );

    expect(screen.getByText('a@b.c')).not.toBeNull();
    expect(screen.getByText('plain')).not.toBeNull();

    const tbody = container.querySelector('tbody');
    if (!tbody) throw new Error('tbody не найден');
    expect(within(tbody).getAllByText('Email')).toHaveLength(1);
  });
});
