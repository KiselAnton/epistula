import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { id: '1', facultyId: '10', subjectId: '100' },
    push: jest.fn(),
    pathname: '/university/[id]',
    asPath: '/university/1',
  }),
}));

// Mock heavy WYSIWYG editor to avoid ESM parsing issues in pages that include editing modals
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));

function mockFetchSequence(map: Record<string, any>) {
  global.fetch = jest.fn(async (url: string) => {
    const entry = Object.entries(map).find(([pattern]) => new RegExp(pattern).test(url));
    if (!entry) {
      return { ok: true, status: 200, json: async () => ({}) } as any;
    }
    const [, value] = entry;
    return { ok: true, status: 200, json: async () => value } as any;
  }) as any;
}

describe('Breadcrumb trimming', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ role: 'root', universities: [1] }));
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    localStorage.clear();
  });

  it('UniversityPage has no "Universities" breadcrumb', async () => {
    mockFetchSequence({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': []
    });
    const Page = require('../../pages/university/[id]').default;
    render(<Page />);
    // Wait for primary content to be ready
    await screen.findByRole('heading', { name: /Faculties/i });
    // Limit the assertion to the breadcrumbs nav to avoid matching other UI text
    const breadcrumbs = screen.getByRole('navigation', { name: /Breadcrumbs/i });
    expect(within(breadcrumbs).queryByText(/Universities/i)).toBeNull();
  });

  it('FacultyPage shows only University and Faculty names in breadcrumbs', async () => {
    mockFetchSequence({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Science', short_name: 'SCI', code: 'SCI', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/subjects/1/10': []
    });
    const Page = require('../../pages/university/[id]/faculty/[facultyId]').default;
    render(<Page />);
    await screen.findByRole('heading', { name: /Science/i });
    const breadcrumbs = screen.getByRole('navigation', { name: /Breadcrumbs/i });
    expect(within(breadcrumbs).queryByText(/Universities/i)).toBeNull();
    expect(within(breadcrumbs).queryByText(/^Faculties$/i)).toBeNull();
    expect(within(breadcrumbs).getByText('Uni A')).toBeInTheDocument();
    expect(within(breadcrumbs).getByText('Science')).toBeInTheDocument();
  });

  it('SubjectPage shows University > Faculty > Subject only', async () => {
    mockFetchSequence({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Science', short_name: 'SCI', code: 'SCI', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/subjects/1/10': [
        { id: 100, faculty_id: 10, name: 'Physics', code: 'PHY', description: 'Mechanics', is_active: true, created_at: new Date().toISOString() },
      ]
    });
    const Page = require('../../pages/university/[id]/faculty/[facultyId]/subject/[subjectId]').default;
    render(<Page />);
    await screen.findByRole('heading', { name: /Physics/i });
    const breadcrumbs = screen.getByRole('navigation', { name: /Breadcrumbs/i });
    expect(within(breadcrumbs).queryByText(/Universities/i)).toBeNull();
    expect(within(breadcrumbs).queryByText(/^Faculties$/i)).toBeNull();
    expect(within(breadcrumbs).queryByText(/^Subjects$/i)).toBeNull();
    expect(within(breadcrumbs).getByText('Uni A')).toBeInTheDocument();
    expect(within(breadcrumbs).getByText('Science')).toBeInTheDocument();
    expect(within(breadcrumbs).getByText('Physics')).toBeInTheDocument();
  });
});
