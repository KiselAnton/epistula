import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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

describe('Subjects favorites', () => {
  beforeEach(() => {
    localStorage.setItem('token', 't');
    localStorage.removeItem('fav:subjects:uni_1:faculty_10');
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    cleanup();
    localStorage.clear();
  });

  it('moves favorited subjects to the top and persists', async () => {
    mockFetch({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Science', short_name: 'SCI', code: 'SCI', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/subjects/1/10': [
        { id: 100, faculty_id: 10, name: 'Algebra', code: 'ALG', description: 'Math', is_active: true, created_at: new Date().toISOString() },
        { id: 101, faculty_id: 10, name: 'Zoology 101', code: 'ZOO', description: 'Animals', is_active: true, created_at: new Date().toISOString() },
      ]
    });

    const Page = require('../../pages/university/[id]/faculty/[facultyId]/subjects').default;
    const { unmount } = render(<Page />);

    await screen.findByText('Subjects - Science');

    // Initially, alphabetical: Algebra before Zoology 101
    const headingsBefore = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsBefore[0]).toHaveTextContent('Algebra');

    // Favorite Zoology 101
    const favBtn = screen.getByLabelText('Favorite Zoology 101');
    fireEvent.click(favBtn);

    const headingsAfter = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsAfter[0]).toHaveTextContent('Zoology 101');

    // Persist across remount
    unmount();
    const Page2 = require('../../pages/university/[id]/faculty/[facultyId]/subjects').default;
    render(<Page2 />);
    await screen.findByText('Subjects - Science');
    const headingsAgain = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsAgain[0]).toHaveTextContent('Zoology 101');
  });
});
