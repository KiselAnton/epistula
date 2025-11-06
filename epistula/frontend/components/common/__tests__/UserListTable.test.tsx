/* eslint-disable react/jsx-key */
import React from 'react';
import { render, screen } from '@testing-library/react';
import UserListTable, { UserListItem } from '../UserListTable';

function mkRow(overrides: Partial<UserListItem> = {}): UserListItem {
  const now = new Date().toISOString();
  return {
    id: Math.floor(Math.random() * 100000),
    name: 'Test User',
    email: 'test@example.com',
    status: 'active',
    dateIso: now,
    ...overrides,
  } as UserListItem;
}

describe('UserListTable', () => {
  it('renders actions returned as an array without key warnings', () => {
    const rows: UserListItem[] = [mkRow({ id: 1, name: 'Alice' }), mkRow({ id: 2, name: 'Bob' })];

    // Temporarily capture console.error to detect React key warnings
    const errorSpy = jest.spyOn(console, 'error');
    const messages: string[] = [];
    errorSpy.mockImplementation((...args: any[]) => {
      try {
        messages.push(args.map(String).join(' '));
      } catch {
        // ignore
      }
    });

    render(
      <UserListTable
        universityId="1"
        rows={rows}
        renderActions={() => [
          <button type="button">View</button>,
          <button type="button">Remove</button>,
        ]}
      />
    );

    // Should render one set of actions per row
    expect(screen.getAllByRole('button', { name: 'View' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);

    // Ensure no React unique key warnings were emitted
    const all = messages.join('\n');
    expect(all).not.toMatch(/Each child in a list should have a unique "key" prop/i);

    // Restore suppression (keep tests quiet globally)
    errorSpy.mockImplementation(() => {});
  });
});
