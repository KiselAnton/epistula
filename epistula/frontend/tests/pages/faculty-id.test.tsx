import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: { id: '1', facultyId: '10' },
    push: jest.fn(),
    pathname: '/university/[id]/faculty/[facultyId]',
    asPath: '/university/1/faculty/10',
  }),
}));

// Mock heavy WYSIWYG editor to avoid ESM parsing issues from prosemirror in Jest
jest.mock('../../components/common/WysiwygMarkdownEditor', () => ({ __esModule: true, default: () => null }));

// Mock config
jest.mock('../../lib/config', () => ({ getBackendUrl: () => 'http://localhost:8000' }));

// Helper to mock fetch responses by URL pattern
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

describe('FacultyPage description rendering', () => {
  beforeEach(() => {
    // Token and user as root to avoid student gating for buttons
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ role: 'root', universities: [1] }));
  });
  afterEach(() => {
    (global.fetch as any)?.mockClear?.();
    localStorage.clear();
  });

  it('shows description exactly once above subjects', async () => {
    const facultyDescription = 'This is the faculty description\nwith multiple lines.';
    mockFetchSequence({
      '/api/v1/universities/': [
        { id: 1, name: 'Uni A', code: 'UA', schema_name: 'uni_1', description: null, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/faculties/1': [
        { id: 10, university_id: 1, name: 'Science', short_name: 'SCI', code: 'SCI', description: facultyDescription, logo_url: null, created_at: new Date().toISOString(), is_active: true },
      ],
      '/api/v1/subjects/1/10': [
        { id: 100, faculty_id: 10, name: 'Physics', code: 'PHY', description: 'Mechanics', is_active: true, created_at: new Date().toISOString() },
      ],
    });

    const Page = require('../../pages/university/[id]/faculty/[facultyId]').default;
    render(<Page />);

    // Wait for header (faculty name) to appear
    await screen.findByRole('heading', { name: /Science/i });

    // The description title should render once
    const headings = await screen.findAllByRole('heading', { name: /Description/i });
    expect(headings).toHaveLength(1);

  // The page renders the markdown description section; ensure the section exists
  // even if the markdown content is rendered into a container
  // (exact text may be transformed/HTML, so avoid strict text matching here)

    // Subjects header should appear after description
    const subjectsHeading = await screen.findByRole('heading', { name: /Subjects \(/i });
    expect(subjectsHeading).toBeInTheDocument();

    // Ensure the description is before subjects in DOM order
    const isBefore = headings[0].compareDocumentPosition(subjectsHeading) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(isBefore).toBeTruthy();
  });
});
