import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

const mockRouter = { query: { id: '1', facultyId: '10' }, push: jest.fn(), pathname: '/university/[id]/faculty/[facultyId]/subjects', asPath: '/university/1/faculty/10/subjects' };
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

describe('Subjects search', () => {
  beforeEach(() => {
    localStorage.setItem('token', 't');
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    localStorage.clear();
  });

  it('filters subjects by search text', async () => {
    mockFetch({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Science', short_name: 'SCI', code: 'SCI', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/subjects/1/10': [
        { id: 100, faculty_id: 10, name: 'Physics', code: 'PHY', description: 'Mechanics', is_active: true, created_at: new Date().toISOString() },
        { id: 101, faculty_id: 10, name: 'Chemistry', code: 'CHE', description: 'Compounds', is_active: true, created_at: new Date().toISOString() },
      ]
    });

    const Page = require('../../pages/university/[id]/faculty/[facultyId]/subjects').default;
    render(<Page />);

    await screen.findByText('Subjects - Science');
    const input = screen.getByLabelText('Search subjects');
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'chem' } });
      // Wait for debounce timeout (250ms) plus a bit extra
      await new Promise(r => setTimeout(r, 350));
    });

    expect(await screen.findByText('Chemistry')).toBeInTheDocument();
    
    // Verify non-matching item is filtered out
    await waitFor(() => {
      expect(screen.queryByText('Physics')).toBeNull();
    });
  });
});
