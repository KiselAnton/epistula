import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

const mockRouter = { query: { id: '1' }, push: jest.fn(), pathname: '/university/[id]/faculties', asPath: '/university/1/faculties' };
jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

function mockFetch(map: Record<string, any>) {
  (global.fetch as any) = jest.fn(async (url: string) => {
    const entry = Object.entries(map).find(([pattern]) => new RegExp(pattern).test(url));
    if (!entry) return { ok: true, status: 200, json: async () => ({}) } as any;
    const [, value] = entry;
    return { ok: true, status: 200, json: async () => value } as any;
  });
}

describe('Faculties search', () => {
  beforeEach(() => {
    localStorage.setItem('token', 't');
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    localStorage.clear();
  });

  it('filters faculties by search text', async () => {
    mockFetch({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Science', short_name: 'SCI', code: 'SCI', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
        { id: 11, university_id: 1, name: 'Arts', short_name: 'ART', code: 'ART', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
    });

    const Page = require('../../pages/university/[id]/faculties').default;
    render(<Page />);

    await screen.findByText('Faculties - Uni A');
    const input = screen.getByLabelText('Search faculties');
    fireEvent.change(input, { target: { value: 'art' } });

    expect(await screen.findByText('Arts')).toBeInTheDocument();
    // Wait for debounced search to apply and non-matching item to disappear
    await screen.findByText('Arts');
    await waitFor(() => expect(screen.queryByText('Science')).not.toBeInTheDocument());
  });
});
