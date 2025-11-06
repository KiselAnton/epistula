import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

const mockRouter = { query: {}, push: jest.fn(), replace: jest.fn(), pathname: '/universities', asPath: '/universities' };
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

describe('Universities favorites', () => {
  beforeEach(() => {
    localStorage.setItem('token', 't');
    localStorage.setItem('user', JSON.stringify({ role: 'root' }));
    localStorage.removeItem('fav:universities');
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    cleanup();
    localStorage.clear();
  });

  it('moves favorites to the top and persists', async () => {
    mockFetch({
      '/api/v1/universities/': [
        { id: 1, name: 'Alpha University', code: 'ALPHA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
        { id: 2, name: 'Zeta University', code: 'ZETA', schema_name: 'uni_2', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
    });

    const Page = require('../../pages/universities').default;
    const { unmount } = render(<Page />);

    // Wait for universities to load
    await screen.findByText('Alpha University');

    // Initially, alphabetical: Alpha before Zeta
    const headingsBefore = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsBefore[0]).toHaveTextContent('Alpha University');

    // Favorite Zeta
    const favBtn = screen.getByLabelText('Favorite Zeta University');
    fireEvent.click(favBtn);

    // Zeta should appear first now
    const headingsAfter = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsAfter[0]).toHaveTextContent('Zeta University');

    // Persisted across remount
    unmount();
    const Page2 = require('../../pages/universities').default;
    render(<Page2 />);
    await screen.findByText('Zeta University');
    const headingsAgain = await screen.findAllByRole('heading', { level: 3 });
    expect(headingsAgain[0]).toHaveTextContent('Zeta University');
  });

  it('favorites sort before non-favorites globally', async () => {
    // Test that favorites from "page 2" data appear before "page 1" non-favorites
    // This tests the core bug fix without needing to navigate pagination
    const universities = [
      { id: 1, name: 'Alpha Uni', code: 'A', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      { id: 2, name: 'Beta Uni', code: 'B', schema_name: 'uni_2', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      { id: 3, name: 'Zulu Uni', code: 'Z', schema_name: 'uni_3', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
    ];

    // Pre-favorite Z (which is alphabetically last)
    localStorage.setItem('fav:universities', JSON.stringify({ 3: true }));

    mockFetch({
      '/api/v1/universities/': universities,
    });

    const Page = require('../../pages/universities').default;
    render(<Page />);

    await screen.findByText('Zulu Uni');

    // Z should be first even though alphabetically last
    const headings = await screen.findAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('Zulu Uni');
    expect(headings[1]).toHaveTextContent('Alpha Uni');
    expect(headings[2]).toHaveTextContent('Beta Uni');
  });
});

