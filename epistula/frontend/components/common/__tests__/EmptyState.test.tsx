import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders icon, title and description', () => {
    render(<EmptyState icon="📄" title="No Data" description="Nothing here yet" />);
    expect(screen.getByText('📄')).toBeInTheDocument();
    expect(screen.getByText('No Data')).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders action button and handles click', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<EmptyState icon="➕" title="Add" actionButton={{ text: 'Create', onClick }} />);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(onClick).toHaveBeenCalled();
  });
});
