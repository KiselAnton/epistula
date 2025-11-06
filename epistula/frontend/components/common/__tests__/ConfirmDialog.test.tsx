import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders when open and triggers callbacks', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <ConfirmDialog
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete item"
        message="Are you sure?"
      />
    );

    expect(screen.getByText('Delete item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('applies warning variant when warning=true', () => {
    const { container } = render(
      <ConfirmDialog
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
        title="Danger"
        message="Proceed?"
        warning
      />
    );
    const buttons = container.querySelectorAll('button');
    const confirmBtn = Array.from(buttons).find(b => /confirm/i.test(b.textContent || '')) as HTMLButtonElement;
    expect(confirmBtn).toBeInTheDocument();
    // Next/jest maps CSS modules to identity-obj-proxy, so class contains the key
    expect(confirmBtn.className).toMatch(/confirmButtonWarning/);
  });
});
