import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../Modal';

describe('Modal', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Title">
        <div>Body</div>
      </Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders content when open and handles close via close button', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title="My Modal">
        <div>Body</div>
      </Modal>
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();

    // Clicking close button should close
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
