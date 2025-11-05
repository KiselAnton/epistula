import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

const mockRouter = { query: { id: '1' }, push: jest.fn(), replace: jest.fn(), pathname: '/university/[id]/faculties', asPath: '/university/1/faculties' };
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

describe('Faculties favorites', () => {
  beforeEach(() => {
    localStorage.setItem('token', 't');
    localStorage.removeItem('fav:faculties:uni_1');
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    cleanup();
    localStorage.clear();
  });

  it('moves favorites to the top and persists', async () => {
    mockFetch({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Botany', short_name: 'BOT', code: 'BOT', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
        { id: 11, university_id: 1, name: 'Zoology', short_name: 'ZOO', code: 'ZOO', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
    });

    const Page = require('../../pages/university/[id]/faculties').default;
    const { unmount } = render(<Page />);

    // Wait for list
    await screen.findByText('Faculties - Uni A');

    // Initially, alphabetical: Botany before Zoology
    const headingsBefore = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsBefore[0]).toHaveTextContent('Botany');

    // Favorite Zoology
    const favBtn = screen.getByLabelText('Favorite Zoology');
    fireEvent.click(favBtn);

    // Zoology should appear first now
    const headingsAfter = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsAfter[0]).toHaveTextContent('Zoology');

    // Persisted across remount
    unmount();
    const Page2 = require('../../pages/university/[id]/faculties').default;
    render(<Page2 />);
    await screen.findByText('Faculties - Uni A');
    const headingsAgain = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsAgain[0]).toHaveTextContent('Zoology');
  });
});
