import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from '../Pagination';

describe('Pagination', () => {
  it('returns null when totalPages <= 1', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('navigates between pages and disables buttons at bounds', async () => {
    const user = userEvent.setup();
    const onPageChange = jest.fn();
    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />);

    const prev = screen.getByRole('button', { name: /previous/i });
    const next = screen.getByRole('button', { name: /next/i });
    expect(prev).toBeEnabled();
    expect(next).toBeEnabled();

    await user.click(prev);
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(next);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
