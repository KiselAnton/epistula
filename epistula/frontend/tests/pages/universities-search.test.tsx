import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

const mockRouter = { query: {}, push: jest.fn(), pathname: '/universities', asPath: '/universities' };
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

describe('Universities search', () => {
  beforeEach(() => {
    localStorage.setItem('token', 't');
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    localStorage.clear();
  });

  function mockFetch(list: any[]) {
    (global.fetch as any) = jest.fn(async (url: string) => {
      if (/\/api\/v1\/universities\/$/.test(url)) {
        return { ok: true, status: 200, json: async () => list } as any;
      }
      return { ok: true, status: 200, json: async () => ({}) } as any;
    });
  }

  it('filters universities by search text', async () => {
    mockFetch([
      { id: 1, name: 'Alpha University', code: 'ALP', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      { id: 2, name: 'Beta Institute', code: 'BET', schema_name: 'uni_2', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      { id: 3, name: 'Gamma College', code: 'GAM', schema_name: 'uni_3', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
    ]);

    const Page = require('../../pages/universities').default;
    render(<Page />);

    // Wait for list
    await screen.findByText('Alpha University');
    const input = screen.getByLabelText('Search universities');
    fireEvent.change(input, { target: { value: 'beta' } });

  // Only Beta should be visible after debounce
  const beta = await screen.findByText('Beta Institute');
  expect(beta).toBeInTheDocument();
  // Wait for non-matching entries to disappear after debounce
  await screen.findByText('Beta Institute');
  await new Promise(r => setTimeout(r, 300));
  await waitFor(() => expect(screen.queryByText('Alpha University')).toBeNull());
  await waitFor(() => expect(screen.queryByText('Gamma College')).toBeNull());
  });
});
